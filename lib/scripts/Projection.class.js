const AWS = require('aws-sdk');
const fs = require('fs');
const child_process = require('child_process');
const Core = require('./Core.class');

const BaseUtils = require('./libs/baseUtils.class');
const DDBUtils = require('./libs/dynamoUtils.class');
const LambdaUtils = require('./libs/lambdaUtils.class');
const SNSUtils = require('./libs/snsUtils.class');
const SQSUtils = require('./libs/sqsUtils.class');
const IAMUtils = require('./libs/iamUtils.class');
const EC2Utils = require('./libs/ec2Utils.class');

const region = process.env.AWS_DEFAULT_REGION;
const credentials = new AWS.Credentials({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

AWS.config = new AWS.Config({ region, credentials });

class Projection extends BaseUtils {
    /**
     * @constructor
     * @param {Object} options 
     * @param {string} options.environment 
     * @param {string} options.microserviceName 
     * @param {string} [options.logLevel] 
     * @param {string} options.TableName Order Control Table name
     * @param {Object} [options.TableOptions] Order Control Table options
     * @param {number} options.TableOptions.RCU Read capacity units
     * @param {number} options.TableOptions.WCU Write capacity units
     * @param {string} options.QueueName Queue name
     * @param {Object} options.Lambda 
     * @param {string} options.Lambda.FunctionName Projector function name
     * @param {string} options.Lambda.RoleName 
     * @param {string} options.Lambda.Handler 
     * @param {Object} options.Lambda.package Projector function package path
     * @param {Object} [options.Lambda.envVars] 
     * @param {string} [options.Lambda.package.file] Projector function single file path
     * @param {string} [options.Lambda.package.folder] Projector function folder path
     * @param {Object} [options.deployProjectionDB] 
     * @param {Object} [options.ProjectionDB] 
     * @param {string} options.ProjectionDB.Type 
     */
    constructor(options = {}) {
        super({ microserviceName: options.microserviceName, environment: options.environment, logLevel: options.logLevel });
        delete options.microserviceName;
        delete options.environment;
        delete options.logLevel;

        Object.assign(this, options);

        this.ProjectionDB = this.ProjectionDB || {};
        this.Lambda.envVars = this.Lambda.envVars || {};
        this._configureClients();
    }
    
    _configureClients() {
        this.ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });
        this.lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
        this.sns = new AWS.SNS({ apiVersion: '2010-03-31' });
        this.sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
        this.iam = new AWS.IAM({ apiVersion: '2010-05-08' });
        this.ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

        this.ddbUtils = new DDBUtils({ client: this.ddb, microserviceName: this.microserviceName, environment: this.environment, logLevel: this.logLevel });
        this.lambdaUtils = new LambdaUtils({ client: this.lambda, microserviceName: this.microserviceName, environment: this.environment, logLevel: this.logLevel });
        this.snsUtils = new SNSUtils({ client: this.sns, microserviceName: this.microserviceName, environment: this.environment, logLevel: this.logLevel });
        this.sqsUtils = new SQSUtils({ client: this.sqs, microserviceName: this.microserviceName, environment: this.environment, logLevel: this.logLevel });
        this.iamUtils = new IAMUtils({ client: this.iam, microserviceName: this.microserviceName, environment: this.environment, logLevel: this.logLevel });
        this.ec2Utils = new EC2Utils({ client: this.ec2, microserviceName: this.microserviceName, environment: this.environment, logLevel: this.logLevel });
    }

    async _getBitnamiUserPassword({ InstanceDNS, privateKeyFilePath, logOutput }) {

        function log(obj) {
            if (logOutput)
                this.log(obj);
        }

        const promise = new Promise((resolve, rejects) => {
            const child = child_process.spawn(`ssh -i ${privateKeyFilePath} -o "StrictHostKeyChecking no" bitnami@${InstanceDNS}`, { shell: true });

            child.stdout.on('data', (data) => {
                log(`stdout: ${data}`);
                const reAddHost = /Are you sure you want to continue connecting \(yes\/no\)\?/;
                if (reAddHost.test(data)) {
                    child.stdin.write('yes\n');
                    return;
                }
                const reUserPass = /The default username and password is '(.+)' and '(.+)'\./;
                if (reUserPass.test(data)) {
                    const result = reUserPass.exec(data);
                    const user = result[1];
                    const password = result[2];
                    resolve({ user, password });
                }
                const reUserPassNotYetAvailable = /The machine is being initialized and the credentials are not yet available.\nPlease, try again later./;
                if (reUserPassNotYetAvailable.test(data)) {
                    rejects('notYetAvailable');
                    child.kill('SIGINT');
                    return;
                }
            });
            child.stderr.on('data', (data) => {
                log(`stderr: ${data}`);
                const reConnRefused = /ssh: connect to host .* port 22: Connection refused/;
                if (reConnRefused.test(data)) {
                    rejects('connRefused');
                    child.kill('SIGINT');
                    return;
                }
                const reConnTimedOut = /ssh: connect to host .* port 22: Connection timed out/;
                if (reConnTimedOut.test(data)) {
                    rejects('timedOut');
                    child.kill('SIGINT');
                    return;
                }
            });
            child.on('error', (err) => {
                console.error(err);
            });
            // child.stdin.write('yes\n');
            child.stdin.write('cat ./bitnami_credentials\n');
            child.stdin.write('exit\n');

        });

        const { user, password } = await promise;
        return { user, password };
    }

    async _launchMongoDBEC2Instance({ KeyName, LaunchTemplateName, options = {} }) {
        const { logOutput, timeouts = {} } = options;
        const pkData = await this.ec2Utils.createKeyPair(KeyName);
        this.log('KeyPair created')
        const instanceIds = await this.ec2Utils.createInstanceFromTemplate({ LaunchTemplate: { Name: LaunchTemplateName }, KeyName });
        this.log('EC2 instance launched from template')
        const pkPath = './pk.pem';
        fs.writeFileSync(pkPath, pkData);
        let mongoCredentials;

        const { initial = 50, interval = 20 } = timeouts;
        const waitAsync = sec => new Promise(resolve => setTimeout(resolve, sec * 1000));
        this.log(`Trying to get mongo credentials in ${initial} seconds...`);
        await waitAsync(initial);
        let attempts = 0;
        let done = false;
        let InstanceDNS = (await this.ec2Utils.getInstacesPublicDNS(instanceIds))[0];
        this.log('Instance Public DNS (IPv4):', InstanceDNS);
        while (!done) {
            try {
                attempts++;
                this.log('Trying to get mongo credentials...');
                mongoCredentials = await this._getBitnamiUserPassword({ InstanceDNS, privateKeyFilePath: pkPath, logOutput });
                if (mongoCredentials)
                    done = true;
            } catch (err) {
                if (attempts >= 25) {
                    this.log(`Too many attepts: ${attempts}`);
                    done = true;
                }
                if (err === 'notYetAvailable') {
                    this.log(`Credentials not available yet. Retrying in ${interval} seconds...`);
                    await waitAsync(interval);
                    done = false;
                } else if (err === 'connRefused') {
                    this.log(`Connection refused, instance may not be ready. Retrying in ${interval} seconds...`);
                    await waitAsync(interval);
                    done = false;
                } else if (err === 'timedOut') {
                    this.log(`Connection timed out, instance may not be ready. Retrying in ${interval} seconds...`);
                    await waitAsync(interval);
                    done = false;
                } else
                    throw err;
            }
        }
        return { InstanceId: instanceIds[0], InstanceDNS, mongoCredentials, pkPath };
    }

    async _terminateMongoDBEC2Instance({ InstanceId, pkPath }) {
        await this.ec2Utils.terminateInstances([InstanceId]);
        fs.unlinkSync(pkPath);
    }

    async _launchProjectionInstance() {
        if (this.ProjectionDB.Type === 'mongodb-ec2') {
            this.ProjectionDB.KeyName = 'MongoDBEC2Keys';
            const LaunchTemplateName = 'MongoDBTemplate';
            const { InstanceId, InstanceDNS, mongoCredentials, pkPath } = await this._launchMongoDBEC2Instance({ KeyName: this.ProjectionDB.KeyName, LaunchTemplateName });
            this.ProjectionDB.pkPath = pkPath;
            this.ProjectionDB.InstanceId = InstanceId;
            this.ProjectionDB.mongoCredentials = mongoCredentials;
            this.ProjectionDB.mongoConnString = `mongodb://${mongoCredentials.user}:${mongoCredentials.password}@${InstanceDNS}`;
            return this.ProjectionDB.mongoConnString;
        }

    }

    async _stopProjectionInstance() {
        if (this.ProjectionDB.Type === 'mongodb-ec2') {
            await this.ec2Utils.deleteKeyPair(this.ProjectionDB.KeyName);
            await this._terminateMongoDBEC2Instance({ InstanceId: this.ProjectionDB.InstanceId, pkPath: this.ProjectionDB.pkPath });
        }
    }

    async build() {
        await this.ddbUtils.buildOrderControlTable(this.TableName, this.TableOptions);
        this.log(`Order Control Table created ${this.TableName}`);
        this.QueueUrl = await this.sqsUtils.createQueue(this.QueueName);
        this.log(`Denormalizer Queue created ${this.QueueName}`);
        if (this.deployProjectionDB) {
            await this._launchProjectionInstance();
            this.log(`Projection Instance created ${this.ProjectionDB.InstanceId}`);
        }
    }

    async _subscribeQueueToTopic({ TopicArn }) {
        this.QueueArn = await this.sqsUtils.getQueueArn({ QueueUrl: this.QueueUrl });
        this.SubscriptionArn = await this.snsUtils.subscribeQueueToTopic({ QueueArn: this.QueueArn, TopicArn });
        await this.sqsUtils.addSubscriptionPermission({ QueueUrl: this.QueueUrl, QueueArn: this.QueueArn, TopicArn });
    }

    /**
     * 
     * @param {Core} core 
     */
    async subscribe(core) {
        if (!(core instanceof Core))
            throw new Error('core must be instance of Core');
        await this._subscribeQueueToTopic({ TopicArn: core.TopicArn });
        this.log(`Projection subscribed to core ${core.TopicArn}`);
    }

    async _createLambdaProjector() {
        this.Lambda.ZipFile = this._createLambdaDeploymentPackage(this.Lambda.package);
        this.Lambda.RoleArn = await this.iamUtils.getRoleArn(this.Lambda.RoleName);
        try {
            await this.lambdaUtils.createLambda(this.Lambda, true);
        } catch (err) {
            if (err.code === 'ResourceConflictException' && !leakError) {
                this.log(`Function already exist: ${this.Lambda.FunctionName}`);
                const RevisionId = await this.lambdaUtils.publishNewVersion(this.Lambda);
                this.log(`Function ${this.Lambda.FunctionName} updated, new version: ${RevisionId}`);
                return;
            }
            throw err;
        }
    }

    async deploy({ envVars }) {
        Object.assign(this.Lambda.envVars, envVars);
        await this._createLambdaProjector();
        this.log(`Lambda created ${this.Lambda.FunctionName}`);
        // Create EventSourceMapping between SQS and projector lambda
        if (!this.QueueArn)
            this.QueueArn = await this.sqsUtils.getQueueArn({ QueueName: this.QueueName, QueueUrl: this.QueueUrl });
        this.ESM_UUID = await this.lambdaUtils.createEventSourceMapping({ FunctionName: this.Lambda.FunctionName, QueueArn: this.QueueArn });
        this.log(`ESM created ${this.ESM_UUID}`);
    }

    async destroy(options = {}) {
        const { deleteLambda = true } = options;
        await this.lambdaUtils.deleteEventSourceMapping(this.ESM_UUID);
        this.log(`Lambda ESM deleted ${this.ESM_UUID}`);
        if (deleteLambda) {
            await this.lambdaUtils.deleteLambda(this.Lambda.FunctionName);
            this.log(`Lambda deleted ${this.Lambda.FunctionName}`);
        }
        if (this.deployProjectionDB) {
            await this._stopProjectionInstance();
            this.log(`Projection Instance terminated`);
        }
        if (this.SubscriptionArn) {
            await this.snsUtils.unsubscribeQueueToTopic(this.SubscriptionArn);
            this.log(`Queue ${this.QueueName} unsubscribed from core Topic`);
        }
        await this.sqsUtils.deleteQueue(this.QueueUrl);
        this.log(`Queue deleted ${this.QueueName}`);
        await this.ddbUtils.deleteTable(this.TableName);
        this.log(`Order control table deleted ${this.TableName}`);
    }
    
    serialize(fileName) {
        const json = JSON.parse(JSON.stringify(this));

        delete json.ddb
        delete json.lambda
        delete json.sns
        delete json.sqs
        delete json.iam
        delete json.ec2

        delete json.ddbUtils
        delete json.lambdaUtils
        delete json.snsUtils
        delete json.sqsUtils
        delete json.iamUtils
        delete json.ec2Utils

        delete json.Lambda.ZipFile

        const data = JSON.stringify(json);
        fs.writeFileSync(fileName || './projection.config.json', data, { encoding: 'utf8' });
    }

    static deserialize(fileName) {
        fileName = fileName || './projection.config.json';
        const data = fs.readFileSync(fileName, { encoding: 'utf8' });
        let options = JSON.parse(data);
        const proj = new Projection(options);

        Object.assign(proj, options);
        fs.unlinkSync(fileName);
        return proj;
    }
}

module.exports = Projection;
