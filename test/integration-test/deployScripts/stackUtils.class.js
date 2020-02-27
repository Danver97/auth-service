const AWS = require('aws-sdk');
const child_process = require('child_process');
const { execSync } = child_process;
const fs = require('fs');
const AdamZip = require('adm-zip');

const DDB_URL = 'http://localhost:4569';
const LAMBDA_URL = 'http://localhost:4574';
const SNS_URL = 'http://localhost:4575';
const SQS_URL = 'http://localhost:4576';
const IAM_URL = 'http://localhost:4593';
const EC2_URL = 'http://localhost:4597';

// ssh -i ./MongoDBTemplate.pem bitnami@<ecs-DNS-ipv4>

class StackUtils {
    /**
     * @constructor
     * @param {Object} options 
     * @param {string} options.accountID 
     * @param {string} options.region 
     * @param {string} options.environment 
     * @param {string} options.cloud 
     * @param {Object} options.credentials 
     * @param {string} options.credentials.accessKeyId 
     * @param {string} options.credentials.secretAccessKey 
     * @param {string} [options.logLevel] 
     */
    constructor(options) {
        if (!options.accountID || !options.region || !options.environment || !options.credentials || !options.credentials.accessKeyId || !options.credentials.secretAccessKey) {
            throw new Error(`Missing constructor parameters:
            ${options.accountID ? '' : 'options.accountID'}
            ${options.region ? '' : 'options.region'}
            ${options.environment ? '' : 'options.environment'}
            ${options.credentials ? '' : 'options.credentials'}
            ${options.credentials.accessKeyId ? '' : 'options.credentials.accessKeyId'}
            ${options.credentials.secretAccessKey ? '' : 'options.credentials.secretAccessKey'}`);
        }
        this.accountID = options.accountID;
        this.region = options.region;
        this.environment = options.environment;
        this.cloud = options.cloud || 'aws';
        this.credentials = new AWS.Credentials(options.credentials);
        this._configureClients();
        this._configureLog(options.logLevel);
    }

    _configureClients() {
        AWS.config = new AWS.Config({ region: this.region, credentials: this.credentials });
        if (this.cloud === 'aws') {
            this.ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });
            this.lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
            this.sns = new AWS.SNS({ apiVersion: '2010-03-31' });
            this.sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
            this.iam = new AWS.IAM({ apiVersion: '2010-05-08' });
            this.ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
        } else if (this.cloud === 'localstack') {
            this.ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10', endpoint: DDB_URL });
            this.lambda = new AWS.Lambda({ apiVersion: '2015-03-31', endpoint: LAMBDA_URL });
            this.sns = new AWS.SNS({ apiVersion: '2010-03-31', endpoint: SNS_URL });
            this.sqs = new AWS.SQS({ apiVersion: '2012-11-05', endpoint: SQS_URL });
            this.iam = new AWS.IAM({ apiVersion: '2010-05-08', endpoint: IAM_URL });
            this.ec2 = new AWS.EC2({ apiVersion: '2016-11-15', endpoint: EC2_URL });
        }
    }

    _configureLog(logLevel) {
        this.logLevels = {
            log: 0,
            warn: 1,
            err: 2,
            noLog: 100,
        }
        this.logLevel = this.logLevels[logLevel] || this.logLevels.log;
    }

    log(obj) {
        if (this.logLevel <= this.logLevels.log)
            console.log(obj);
    }

    warn(obj) {
        if (this.logLevel <= this.logLevels.warn)
            console.warn(obj);
    }

    // DynamoDB

    async buildOrderControlTable(TableName, options = {}) {
        const { RCU = 5, WCU = 5 } = options;
        const response = await this.ddb.createTable({
            TableName,
            AttributeDefinitions: [{
                AttributeName: "StreamId",
                AttributeType: "S"
            }],
            KeySchema: [{
                AttributeName: "StreamId",
                KeyType: "HASH"
            }],
            ProvisionedThroughput: {
                ReadCapacityUnits: RCU,
                WriteCapacityUnits: WCU
            },
            Tags: [
                {
                    Key: 'Environment',
                    Value: this.environment,
                },
            ]
        }).promise();
        this.log('Order Control Table created');
        return response;
    }

    async buildEventStreamTable(TableName, options = {}) {
        const { RCU = 5, WCU = 5 } = options;
        const response = await this.ddb.createTable({
            TableName,
            AttributeDefinitions: [
                {
                    AttributeName: "StreamId",
                    AttributeType: "S"
                },
                {
                    AttributeName: "EventId",
                    AttributeType: "N"
                },
                {
                    AttributeName: "ReplayStreamId",
                    AttributeType: "N"
                },
                {
                    AttributeName: "RSSortKey",
                    AttributeType: "S"
                },
            ],
            KeySchema: [
                {
                    AttributeName: "StreamId",
                    KeyType: "HASH"
                },
                {
                    AttributeName: "EventId",
                    KeyType: "RANGE"
                }
            ],
            GlobalSecondaryIndexes: [{
                IndexName: 'ReplayIndex', /* required */
                KeySchema: [{
                    AttributeName: 'ReplayStreamId', /* required */
                    KeyType: 'HASH' /* required */
                }, {
                    AttributeName: 'RSSortKey', /* required */
                    KeyType: 'RANGE' /* required */
                }],
                Projection: {
                    ProjectionType: 'ALL'
                },
                ProvisionedThroughput: {
                    ReadCapacityUnits: RCU,
                    WriteCapacityUnits: WCU,
                }
            }],
            StreamSpecification: {
                StreamEnabled: true,
                StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
            ProvisionedThroughput: {
                ReadCapacityUnits: RCU,
                WriteCapacityUnits: WCU
            },
            Tags: [
                {
                    Key: 'Environment',
                    Value: this.environment,
                },
            ]
        }).promise();
        this.log('Event Stream Table created');
        return response;
    }

    async getTableStreamArn(TableName) {
        const response = await this.ddb.describeTable({ TableName }).promise();
        return response.Table.LatestStreamArn;
    }

    async deleteTable(TableName) {
        try {
            await this.ddb.deleteTable({ TableName }).promise();
            this.log('Table deleted');
        } catch (err) {
            if (err.code === 'ResourceNotFoundException') {
                this.log(`Table ${TableName} does not exists`);
                return;
            }
            throw err;
        }
    }

    // SQS

    async createQueue(QueueName) {
        const response = await this.sqs.createQueue({
            QueueName,
            tags: {
                Environment: this.environment
            }
        }).promise();
        this.log('Queue created');
        const QueueUrl = response.QueueUrl;
        await this.sqs.addPermission({
            AWSAccountIds: [this.accountID],
            Actions: ['SendMessage'],
            Label: 'DefaultSendMessage',
            QueueUrl,
        }).promise();
        return QueueUrl;
    }

    async getQueueUrl(QueueName) {
        let response;
        try {
            response = await this.sqs.getQueueUrl({ QueueName }).promise();
        } catch (err) {
            if (err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
                this.log(`Queue ${QueueName} does not exists`);
                return;
            }
            throw err;
        }
        return response.QueueUrl;
    }

    async getQueueArn(options = {}) {
        const { QueueName } = options;
        let { QueueUrl } = options;
        let response
        try {
            if (QueueName)
                QueueUrl = await this.getQueueUrl(QueueName);
            response = await this.sqs.getQueueAttributes({
                QueueUrl, /* required */
                AttributeNames: ['QueueArn'],
            }).promise();
        } catch (err) {
            if (err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
                this.log(`Queue ${QueueUrl ? QueueUrl : QueueName} does not exists`);
                return;
            }
            throw err;
        }
        return response.Attributes.QueueArn;
    }

    async deleteQueue(options = {}) {
        const { QueueName } = options;
        let { QueueUrl } = options;
        if (QueueName)
            QueueUrl = await this.getQueueUrl(QueueName);
        try {
            await this.sqs.deleteQueue({ QueueUrl }).promise();
            this.log('Queue deleted');
        } catch (err) {
            if (err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
                this.log(`Queue ${QueueUrl} does not exists`);
                return;
            }
            throw err;
        }
    }

    // SNS

    async createTopic(TopicName) {
        const response = await this.sns.createTopic({
            Name: TopicName,
            Tags: [
                {
                    Key: 'Environment',
                    Value: this.environment,
                },
            ]
        }).promise();
        this.log('Topic created');
        return response.TopicArn;
    }

    async getTopicArn(TopicName) {
        const response = await this.sns.createTopic({ Name: TopicName }).promise();
        return response.TopicArn;
    }

    /**
     * 
     * @param {Object} options 
     * @param {string} options.TopicName 
     * @param {string} options.TopicArn 
     * @param {string} options.QueueName 
     * @param {string} options.QueueArn 
     */
    async subscribeQueueToTopic(options) {
        const { TopicName, QueueName } = options;
        let { TopicArn, QueueArn } = options;
        if (TopicName)
            TopicArn = await this.getTopicArn(TopicName);
        if (QueueName)
            QueueArn = await this.getQueueArn({ QueueName });
        const response = await this.sns.subscribe({
            Protocol: 'sqs',
            TopicArn,
            Endpoint: QueueArn,
            ReturnSubscriptionArn: true
        }).promise();
        this.log('Queue subscribed to Topic');
        return response;
    }

    /**
     * 
     * @param {Object} options 
     * @param {string} options.TopicName 
     * @param {string} options.TopicArn 
     */
    async deleteTopic(options) {
        const { TopicName } = options;
        let { TopicArn } = options;
        if (TopicName)
            TopicArn = await this.getTopicArn(TopicName);
        await this.sns.deleteTopic({ TopicArn }).promise();
        this.log('Topic deleted');
    }

    // Lambda

    /**
     * Creates a new Lambda function
     * @param {Object} options 
     * @param {Object} options.FunctionName 
     * @param {Object} options.ZipFile 
     * @param {Object} options.Handler 
     * @param {Object} options.RoleArn 
     * @param {Object} options.envVars 
     * @param {Object} [options.Runtime] 
     * @param {Object} [options.MemorySize] 
     * @param {Object} [options.Description] 
     */
    async createLambda(options = {}) {
        const { FunctionName, RoleArn, ZipFile, Handler, Runtime, MemorySize, Timeout, Description } = options;
        let { envVars = {} } = options;
        let response;
        try {
            const params = {
                Code: {
                    ZipFile,
                },
                Description,
                FunctionName,
                Handler, // is of the form of the name of your source file and then name of your function handler
                MemorySize: MemorySize || 128,
                Publish: true,
                Role: RoleArn, // replace with the actual arn of the execution role you created
                Runtime: Runtime || "nodejs12.x",
                Timeout: Timeout || 3,
                Environment: {
                    Variables: envVars
                },
                Tags: {
                    Environment: this.environment,
                }
            };
            if (this.cloud === 'localstack')
                params.Environment.Variables.SNS_URL = SNS_URL;
            response = await this.lambda.createFunction(params).promise();
        } catch (err) {
            if (err.code === 'ResourceConflictException') {
                this.log(`Function already exist: ${FunctionName}`);
                return;
            }
            throw err;
        }
        this.log('Lambda created');
        return response;
    }

    /**
     * 
     * @param {Object} options 
     * @param {string} options.FunctionName Lambda function name to which create the mapping
     * @param {string} [options.TableName] Name of the DynamoDB table to which create a mapping on the streams
     * @param {string} [options.StreamArn] Arn of the DynamoDB stream to which create a mapping
     * @param {string} [options.QueueName] Name of the SQS queue to which create a mapping
     * @param {string} [options.QueueUrl] Url of the SQS queue to which create a mapping
     * @param {string} [options.QueueArn] Arn of the SQS queue to which create a mapping
     */
    async createEventSourceMapping(options) {
        const { QueueName, QueueUrl, TableName, FunctionName } = options;
        let { QueueArn, StreamArn } = options;
        if (QueueName || QueueUrl)
            QueueArn = await this.getQueueArn({ QueueName, QueueUrl });
        if (TableName)
            StreamArn = await this.getTableStreamArn(TableName);

        const EventSourceArn = StreamArn || QueueArn;
        const BatchSize = 10;

        const params = {
            EventSourceArn,
            FunctionName,
            BatchSize,
        };
        if (StreamArn) {
            params.StartingPosition = 'LATEST';
            params.BatchSize = 1000;
        }
        try {
            const response2 = await this.lambda.createEventSourceMapping(params).promise();
            this.log('EventSourceMapping created');
        } catch (err) {
            if (err.code === 'ResourceConflictException') {
                this.log('EventSourceMapping already exists');
                const UUID = /UUID (.*)/.exec(err.message)[1];
                return UUID;
            } else
                throw err;
        }
        const response2 = await this.lambda.createEventSourceMapping(params).promise();
        this.log('EventSourceMapping created');
        return response2.UUID;
    }

    async deleteEventSourceMapping(UUID) {
        await this.lambda.deleteEventSourceMapping({ UUID });
    }

    async deleteLambda(FunctionName) {
        try {
            await this.lambda.deleteFunction({ FunctionName }).promise();
            this.log('Lambda deleted');
        } catch (err) {
            if (err.code === 'ResourceNotFoundException') {
                this.log(`Lambda ${FunctionName} does not exists`);
                return;
            }
            throw err;
        }
    }

    // IAM

    /**
     * Creates a lambda execution role
     * @param {Object} options 
     * @param {string} options.RoleName 
     * @param {Object} options.rolePolicy 
     */
    async createLambdaRole(options) {
        const { RoleName, rolePolicy } = options;
        try {
            const response = await this.iam.getRole({ RoleName }).promise();
            this.log('Lambda Role already exists');
            return response.Role.Arn;
        } catch (err) {
            if (err.code !== 'NoSuchEntity')
                throw err;
        }

        const assumeRolePolicy = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: {
                        Service: "lambda.amazonaws.com"
                    },
                    Action: "sts:AssumeRole"
                }
            ]
        };
        let response1;
        try {
            response1 = await this.iam.createRole({
                AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicy),
                RoleName,
            }).promise();
        } catch (err) {
            if (err.code === 'EntityAlreadyExists') {
                this.log('Role already exists');
                return;
            }
            throw err;
        }
        const RoleArn = response1.Role.Arn;

        const response2 = await this.iam.putRolePolicy({
            PolicyDocument: JSON.stringify(rolePolicy),
            PolicyName: "DDBS2SNSAccessPolicy",
            RoleName,
        }).promise();
        this.log('Lambda Role created');
        return RoleArn;
    }

    async getRoleArn(RoleName) {
        const response = await this.iam.getRole({ RoleName }).promise();
        return response.Role.Arn;
    }

    // EC2

    async createKeyPair(KeyName) {
        const response = await this.ec2.createKeyPair({ KeyName }).promise();
        return response.KeyMaterial;
    }

    async deleteKeyPair(KeyName) {
        const response = await this.ec2.deleteKeyPair({ KeyName }).promise();
        return response;
    }

    /**
     * 
     * @param {Object} options 
     * @param {Object} options.KeyName
     * @param {Object} options.LaunchTemplate
     * @param {string} [options.LaunchTemplate.Id] 
     * @param {string} [options.LaunchTemplate.Name] 
     * @param {string} [options.LaunchTemplate.Version] 
     * @returns {string[]} A list of instace ids
     */
    async createInstanceFromTemplate(options = {}) {
        const { KeyName, LaunchTemplate } = options;
        let { MinCount, MaxCount } = options;
        if (!MinCount)
            MinCount = 1;
        if (!MaxCount)
            MaxCount = MinCount;
        const { Id: LaunchTemplateId, Name: LaunchTemplateName, Version } = LaunchTemplate;
        const params = { KeyName, MinCount, MaxCount, LaunchTemplate: {} };
        if (LaunchTemplateId)
            params.LaunchTemplate.LaunchTemplateId = LaunchTemplateId;
        else if (LaunchTemplateName)
            params.LaunchTemplate.LaunchTemplateName = LaunchTemplateName;
        if (Version)
            params.LaunchTemplate.Version = Version;

        const response = await this.ec2.runInstances(params).promise();
        return response.Instances.map(i => i.InstanceId);
    }

    async getInstacesStates(InstanceIds) {
        const response = await this.ec2.describeInstanceStatus({
            InstanceIds,
        }).promise();
        const states = response.InstanceStatuses.map(i => i.InstanceState);
        return states;
    }

    async getInstacesPublicDNS(InstanceIds) {
        const response = await this.ec2.describeInstances({
            InstanceIds,
        }).promise();
        const dnsList = response.Reservations[0].Instances.map(i => i.PublicDnsName); // Not sure about 'Reservations[0]'
        return dnsList;
    }

    async terminateInstances(InstanceIds) {
        await this.ec2.terminateInstances({ InstanceIds }).promise();
    }




    // More Utils

    /**
     * 
     * @param {Object} options 
     * @param {string} options.RoleName 
     * @param {string} options.FunctionName 
     * @param {string} options.TableName 
     */
    async createDDB2SNSLambdaRole(options) {
        const { FunctionName, TableName } = options;
        const rolePolicy = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: "lambda:InvokeFunction",
                    Resource: `arn:aws:lambda:${this.region}:${this.accountID}:function:${FunctionName}*`
                },
                {
                    Effect: "Allow",
                    Action: [
                        "logs:CreateLogGroup",
                        "logs:CreateLogStream",
                        "logs:PutLogEvents"
                    ],
                    Resource: `arn:aws:logs:${this.region}:${this.accountID}:*`
                },
                {
                    Effect: "Allow",
                    Action: [
                        "dynamodb:DescribeStream",
                        "dynamodb:GetRecords",
                        "dynamodb:GetShardIterator",
                        "dynamodb:ListStreams"
                    ],
                    Resource: `arn:aws:dynamodb:${this.region}:${this.accountID}:table/${TableName}/stream/*`
                },
                {
                    Effect: "Allow",
                    Action: [
                        "sns:Publish"
                    ],
                    Resource: [
                        "*"
                    ]
                }
            ]
        };
        options.rolePolicy = rolePolicy;
        const response = await this.createLambdaRole(options);
        return response;
    }

    /**
     * 
     * @param {Object} options 
     * @param {string} options.file Path to the single file to zip
     * @param {string} options.folder Path to the package on which install npm dependencies and to zip
     * @param {Object} debugOptions 
     * @param {boolean} debugOptions.dumpZip Writes zip file
     * @param {boolean} debugOptions.logInstall Log 'npm install' output
     */
    async createDeploymentPackage(options = {}, debugOptions = {}) {
        const { folder, file } = options;
        const zip = new AdamZip();

        if (!folder && !file)
            throw new Error('Missing folder and file paramters from options');
        if (folder && file)
            throw new Error('Please specify just one between folder and file paramters from options');

        if (file) {
            let splits = file.split('/');
            if (splits.length <= 0)
                splits = file.split('\\');
            if (splits.length <= 0)
                throw new Error('File path not valid');
            const zipfilename = splits[splits.length - 1];
            const data = fs.readFileSync(file, { encoding: 'utf8' });
            zip.addFile(zipfilename, Buffer.alloc(data.length, data));
        }

        if (folder) {
            const result = execSync(`cd ${folder} && npm install`);
            if (debugOptions.logInstall)
                this.log(result.toString());
            zip.addLocalFolder(folder);
            fs.rmdirSync(`${folder}/node_modules`, { recursive: true });
        }

        const buff = zip.toBuffer();
        if (debugOptions.dumpZip)
            zip.writeZip('./deploymentPackage.zip');
        return buff;
    }

    async getBitnamiUserPassword({ InstanceId, InstanceDNS, privateKeyFilePath, logOutput }) {
        if (InstanceId)
            InstanceDNS = (await this.getInstacesPublicDNS([InstanceId]))[0];

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


    // Denormalizer utils

    async createDenormalizerLambda(lambdaOptions, deploymentPackageOptions) {
        const zip = await this.createDeploymentPackage(deploymentPackageOptions);
        lambdaOptions.ZipFile = zip;
        lambdaOptions.RoleArn = lambdaOptions.RoleArn || 'arn:aws:iam::901546846327:role/denormalizerRole';
        await this.createLambda(lambdaOptions);
    }

    async launchMongoInstance(KeyName, LaunchTemplateName, options = {}) {
        const { logOutput, timeouts = {} } = options;
        const pkData = await this.createKeyPair(KeyName);
        this.log('KeyPair created')
        const instanceIds = await this.createInstanceFromTemplate({ LaunchTemplate: { Name: LaunchTemplateName }, KeyName });
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
        let InstanceDNS = (await this.getInstacesPublicDNS(instanceIds))[0];
        this.log('Instance Public DNS (IPv4):', InstanceDNS);
        while (!done) {
            try {
                attempts++;
                this.log('Trying to get mongo credentials...');
                mongoCredentials = await this.getBitnamiUserPassword({ InstanceDNS, privateKeyFilePath: pkPath, logOutput });
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
        fs.unlinkSync(pkPath);
        return { InstanceId: instanceIds[0], InstanceDNS, mongoCredentials };
    }

    async stopMongoInstance(KeyName, InstanceId) {
        await this.terminateInstances([InstanceId]);
        this.log(`Instance ${InstanceId} terminated`);
        await this.deleteKeyPair(KeyName);
        this.log(`KeyPair ${KeyName} deleted`);
    }

    /**
     * 
     * @param {Object} options 
     * @param {string} options.QueueName Denormalizer queue
     * @param {string} options.OrderControlTableName Denormalizer order control table name
     * @param {boolean} options.deployLambda Flag to say if the lambda should be deployed and linked to the queue
     * @param {Object} [options.lambdaOptions] Lambda options
     * @param {string} options.lambdaOptions.FunctionName Denormalizer name, will be the lambda function name
     * @param {string} options.lambdaOptions.Handler 
     * @param {string} [options.lambdaOptions.RoleArn] 
     * @param {Object} [options.lambdaOptions.envVars] 
     * @param {Object} [options.deploymentPackageOptions] 
     * @param {string} options.deploymentPackageOptions.file Path to single file package to deploy
     * @param {string} options.deploymentPackageOptions.folder Path to package to deploy
     */
    async createDenormalizerStack(options = {}) {
        const QueueName = options.QueueName || 'TestQueue';
        const OrderControlTableName = options.OrderControlTableName || 'TestOrderControlTable';
        await this.createQueue(QueueName);
        await this.buildOrderControlTable(OrderControlTableName);
        let EventSourceMappingUUID
        if (options.deployLambda) {
            await this.createDenormalizerLambda(options.lambdaOptions, options.deploymentPackageOptions);
            EventSourceMappingUUID = await this.createEventSourceMapping({ QueueName, FunctionName: options.lambdaOptions.FunctionName });
        }
        return EventSourceMappingUUID;
    }

    async deleteDenormalizerStack(options = {}) {
        const QueueName = options.QueueName || 'TestQueue';
        const OrderControlTableName = options.OrderControlTableName || 'TestOrderControlTable';
        const EventSourceMappingUUID = options.EventSourceMappingUUID;

        await this.deleteQueue({ QueueName });
        await this.deleteTable(OrderControlTableName);
        if (options.lambdaDeployed) {
            const FunctionName = options.lambdaOptions.FunctionName;
            if (EventSourceMappingUUID)
                await this.deleteEventSourceMapping(EventSourceMappingUUID);
            await this.deleteLambda(FunctionName);
        }
    }

    // Event Sourcing utils

    /**
     * 
     * @param {Object} options 
     * @param {string} options.TableName 
     * @param {string} options.QueueName 
     * @param {string} options.TopicName 
     * @param {string} options.RoleName 
     * @param {Object} options.DDB2SNSLambdaOptions 
     * @param {string} options.DDB2SNSLambdaOptions.FunctionName 
     * @param {string} options.DDB2SNSLambdaOptions.Handler 
     * @param {Object} [options.DDB2SNSLambdaOptions.envVars] 
     * @param {string} [options.DDB2SNSLambdaOptions.envVars.TOPIC_ARN] 
     * @param {string} [options.DDB2SNSLambdaOptions.envVars.AWS_ACCESS_KEY_ID] 
     * @param {string} [options.DDB2SNSLambdaOptions.envVars.AWS_SECRET_ACCESS_KEY] 
     * @param {string} [options.DDB2SNSLambdaOptions.envVars.AWS_DEFAULT_REGION] 
     * @param {string} [options.DDB2SNSLambdaOptions.envVars.SNS_URL] 
     * @param {Object} options.DDB2SNSLambdaOptions.path Specify the configuration of the package
     * @param {Buffer} [options.DDB2SNSLambdaOptions.path.zip] Path to the package folder
     * @param {string} [options.DDB2SNSLambdaOptions.path.folder] Path to the package folder
     * @param {string} [options.DDB2SNSLambdaOptions.path.file] Path to the single file package
     */
    async createEventSourcingStack(options) {
        if (!options.DDB2SNSLambdaOptions || !options.DDB2SNSLambdaOptions.FunctionName || !options.DDB2SNSLambdaOptions.Handler || !options.DDB2SNSLambdaOptions.path)
            throw new Error(`Missing some parameters:
            ${options.DDB2SNSLambdaOptions ? '' : 'options.DDB2SNSLambdaOptions'}
            ${options.DDB2SNSLambdaOptions.FunctionName ? '' : 'options.DDB2SNSLambdaOptions.FunctionName'}
            ${options.DDB2SNSLambdaOptions.Handler ? '' : 'options.DDB2SNSLambdaOptions.Handler'}
            ${options.DDB2SNSLambdaOptions.path ? '' : 'options.DDB2SNSLambdaOptions.path'}`);
        if (!options.DDB2SNSLambdaOptions.path.zip && !options.DDB2SNSLambdaOptions.path.folder && !options.DDB2SNSLambdaOptions.path.file)
            throw new Error('Missing some parameters from options.DDB2SNSLambdaOptions.path, required at least one between' +
                'options.DDB2SNSLambdaOptions.path.zip, options.DDB2SNSLambdaOptions.path.folder and options.DDB2SNSLambdaOptions.path.file');
        const TableName = options.TableName || 'TestTable';
        const QueueName = options.QueueName || 'TestQueue';
        const TopicName = options.TopicName || 'TestTopic';
        const RoleName = options.RoleName || 'TestRole';
        const DDB2SNSLambdaOptions = options.DDB2SNSLambdaOptions || {};

        await this.buildEventStreamTable(TableName);
        const TopicArn = await this.createTopic(TopicName);
        const QueueUrl = await this.createQueue(QueueName);
        const QueueArn = await this.getQueueArn({ QueueUrl });
        await this.subscribeQueueToTopic({ TopicArn, QueueArn });

        // Create lambda role
        const { FunctionName } = DDB2SNSLambdaOptions;
        const RoleArn = await this.createDDB2SNSLambdaRole({ RoleName, FunctionName, TableName });

        // Create DDB Streams to SNS lambda function
        const { Handler, path: packagePath = {} } = DDB2SNSLambdaOptions;
        /* const defaultEnvVars = {
            TOPIC_ARN: TopicArn,
            AWS_ACCESS_KEY_ID: this.credentials.accessKeyId,
            AWS_SECRET_ACCESS_KEY: this.credentials.secretAccessKey,
            AWS_DEFAULT_REGION: this.region,
        }
        const envVars = Object.assign(defaultEnvVars, DDB2SNSLambdaOptions.envVars); */
        const { envVars = {} } = DDB2SNSLambdaOptions;
        let ZipFile;
        if (packagePath.zip)
            ZipFile = zip;
        else if (packagePath.folder || packagePath.file)
            ZipFile = await this.createDeploymentPackage(packagePath);
        await this.createLambda({ FunctionName, ZipFile, Handler, RoleArn, envVars });

        // Create EventMapping between DDB Streams and the previous lambda function
        await this.createEventSourceMapping({ TableName, FunctionName });
    }

    /**
     * 
     * @param {Object} options 
     * @param {string} options.TableName 
     * @param {string} options.QueueName 
     * @param {string} options.TopicName 
     * @param {string} options.RoleName 
     * @param {Object} options.DDB2SNSLambdaOptions 
     * @param {string} options.DDB2SNSLambdaOptions.FunctionName 
     */
    async deleteEventSourcingStack(options = {}) {
        const TableName = options.TableName || 'TestTable';
        const QueueName = options.QueueName || 'TestQueue';
        const TopicName = options.TopicName || 'TestTopic';
        // const RoleName = options.RoleName || 'TestRole';
        const DDB2SNSLambdaOptions = options.DDB2SNSLambdaOptions || {};
        const FunctionName = DDB2SNSLambdaOptions.FunctionName || 'DDBStreamsToSNS';

        await this.deleteLambda(FunctionName);
        await this.deleteTable(TableName);
        const TopicArn = await this.getTopicArn(TopicName);
        await this.deleteTopic({ TopicArn });
        const QueueUrl = await this.getQueueUrl(QueueName);
        if (QueueUrl)
            await this.deleteQueue({ QueueUrl });

    }
}

module.exports = StackUtils;
