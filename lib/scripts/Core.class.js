const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

const BaseUtils = require('./libs/baseUtils.class');
const DDBUtils = require('./libs/dynamoUtils.class');
const LambdaUtils = require('./libs/lambdaUtils.class');
const SNSUtils = require('./libs/snsUtils.class');
const SQSUtils = require('./libs/sqsUtils.class');
const IAMUtils = require('./libs/iamUtils.class');

const region = process.env.AWS_DEFAULT_REGION;
const credentials = new AWS.Credentials({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

AWS.config = new AWS.Config({ region, credentials });

class Core extends BaseUtils {
    /**
     * @constructor
     * @param {Object} options 
     * @param {string} options.environment 
     * @param {string} options.microserviceName 
     * @param {string} [options.logLevel] 
     * @param {string} options.TableName Event Stream table name
     * @param {Object} [options.TableOptions] Event Stream table options
     * @param {number} options.TableOptions.RCU Read capacity units
     * @param {number} options.TableOptions.WCU Write capacity units
     * @param {string} options.TopicName 
     * @param {string} options.QueueName 
     * @param {Object} [options.Lambda] 
     * @param {string} options.Lambda.FunctionName DDBS2SNS function name
     * @param {string} [options.Lambda.Handler] 
     * @param {Object} [options.Lambda.envVars] 
     * @param {Object} [options.Lambda.package] DDBS2SNS function package path
     * @param {string} [options.Lambda.package.file] DDBS2SNS function package path
     * @param {string} [options.Lambda.package.folder] DDBS2SNS function package path
     */
    constructor(options = {}) {
        super({ microserviceName: options.microserviceName, environment: options.environment, logLevel: options.logLevel });
        delete options.microserviceName;
        delete options.environment;
        delete options.logLevel;

        if (!options.TableName || !options.TopicName || !options.QueueName || (options.Lambda && !options.Lambda.FunctionName))
            throw new Error(`Missing following parameters from options:
            ${options.TableName ? '' : 'options.TableName'}
            ${options.TopicName ? '' : 'options.TopicName'}
            ${options.QueueName ? '' : 'options.QueueName'}
            ${(options.Lambda && !options.Lambda.FunctionName) ? 'options.Lambda.FunctionName' : ''}`);

        this.region = region;
        this.credentials = credentials;

        Object.assign(this, options);

        this._setDefaultLambdaOptions();
        this._setDefaultTableOptions();
        this._configureClients();
    }
    
    _configureClients() {
        this.ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });
        this.lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
        this.sns = new AWS.SNS({ apiVersion: '2010-03-31' });
        this.sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
        this.iam = new AWS.IAM({ apiVersion: '2010-05-08' });
        // this.ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

        this.ddbUtils = new DDBUtils({ client: this.ddb, microserviceName: this.microserviceName, environment: this.environment, logLevel: this.logLevel });
        this.lambdaUtils = new LambdaUtils({ client: this.lambda, microserviceName: this.microserviceName, environment: this.environment, logLevel: this.logLevel });
        this.snsUtils = new SNSUtils({ client: this.sns, microserviceName: this.microserviceName, environment: this.environment, logLevel: this.logLevel });
        this.sqsUtils = new SQSUtils({ client: this.sqs, microserviceName: this.microserviceName, environment: this.environment, logLevel: this.logLevel });
        this.iamUtils = new IAMUtils({ client: this.iam, microserviceName: this.microserviceName, environment: this.environment, logLevel: this.logLevel });
    }

    _setDefaultLambdaOptions() {
        this.Lambda = this.Lambda || {};
        this.Lambda.FunctionName = this.Lambda.FunctionName || `${this.microserviceName}DDBS2SNS`;
        this.Lambda.Handler = this.Lambda.Handler || `DDBS2SNS_2.toSNS`;
        this.Lambda.RoleName = 'DDBS2SNSRole';
        this.Lambda.package = this.Lambda.package || { file: path.resolve(__dirname, './DDBS2SNS_2.js') };
    }

    _setDefaultTableOptions() {
        this.TableOptions = this.TableOptions || { RCU: 5, WCU: 5 };
    }

    /**
     * Creates a new Lambda function
     * @param {Object} options 
     * @param {Object} options.FunctionName 
     * @param {Object} options.ZipFile 
     * @param {Object} options.Handler 
     * @param {Object} [options.RoleName] 
     * @param {Object} [options.RoleArn] 
     * @param {Object} [options.envVars] 
     * @param {Object} [options.Runtime] 
     * @param {Object} [options.MemorySize] 
     * @param {Object} [options.Description] 
     */
    async _createDDBS2SNSLambda(options = {}) {
        if (!options.Timeout)
            options.Timeout = 3;
        if (!options.RoleArn)
            options.RoleArn = await this.iamUtils.getRoleArn(options.RoleName);
        options.Description = options.Description || 'Send DDB Streams entries to SNS so that SNS can notify subscribers.';
        let response = await this.lambdaUtils.createLambda(options);
        return response;
    }

    async _subscribeQueueToTopic({ TopicArn }) {
        this.QueueArn = await this.sqsUtils.getQueueArn({ QueueUrl: this.QueueUrl });
        this.SubscriptionArn = await this.snsUtils.subscribeQueueToTopic({ QueueArn: this.QueueArn, TopicArn });
        await this.sqsUtils.addSubscriptionPermission({ QueueUrl: this.QueueUrl, QueueArn: this.QueueArn, TopicArn });
    }

    async build() {
        this.StreamArn = await this.ddbUtils.buildEventStreamTable(this.TableName, this.TableOptions);
        this.log(`Event Stream Table ${this.TableName} created`);
        this.TopicArn = await this.snsUtils.createTopic(this.TopicName)
        this.log(`Topic created ${this.TopicName}`);
        this.QueueUrl = await this.sqsUtils.createQueue(this.QueueName);
        this.log(`Queue created ${this.QueueName}`);
        await this._subscribeQueueToTopic({ TopicArn: this.TopicArn });
        this.log(`Queue ${this.QueueName} subscribed to Topic ${this.TopicName}`);

        // Creazione Lambda DDBS2SNS
        this.Lambda.envVars = this.Lambda.envVars || { TOPIC_ARN: this.TopicArn };
        const ZipFile = this._createLambdaDeploymentPackage(this.Lambda.package);
        await this._createDDBS2SNSLambda({ FunctionName: this.Lambda.FunctionName,
            Handler: this.Lambda.Handler,
            RoleName: this.Lambda.RoleName,
            ZipFile,
            envVars: { TOPIC_ARN: this.TopicArn } });
        this.log(`Lambda created ${this.Lambda.FunctionName}`);
        // Creazione ESM 
        this.ESM_UUID = await this.lambdaUtils.createEventSourceMapping({ FunctionName: this.Lambda.FunctionName, StreamArn: this.StreamArn });
        this.log(`EventSourceMapping created ${this.ESM_UUID}`);
    }

    async deploy() {
        throw new Error('Not implemented');
    }

    async destroy() {
        // un-deploy (to do!)
        //
        //
        await this.lambdaUtils.deleteEventSourceMapping(this.ESM_UUID);
        this.log(`EventSourceMapping deleted ${this.ESM_UUID}`);
        await this.lambdaUtils.deleteLambda(this.Lambda.FunctionName);
        this.log(`Lambda deleted ${this.Lambda.FunctionName}`);
        await this.snsUtils.unsubscribeQueueToTopic(this.SubscriptionArn);
        this.log(`Queue ${this.QueueName} unsubscribed from Topic ${this.TopicName}`);
        await this.sqsUtils.deleteQueue(this.QueueUrl);
        this.log(`Queue deleted ${this.QueueName}`);
        await this.snsUtils.deleteTopic(this.TopicArn);
        this.log(`Topic deleted ${this.TopicName}`);
        await this.ddbUtils.deleteTable(this.TableName);
        this.log(`Event Stream Table ${this.TableName} deleted`);
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

        const data = JSON.stringify(json);
        fs.writeFileSync(fileName || './core.config.json', data, { encoding: 'utf8' });
    }

    static deserialize(fileName) {
        fileName = fileName || './core.config.json';
        const data = fs.readFileSync(fileName, { encoding: 'utf8' });
        let options = JSON.parse(data);
        const core = new Core(options);

        Object.assign(core, options);
        fs.unlinkSync(fileName);
        return core;
    }
}

module.exports = Core;
