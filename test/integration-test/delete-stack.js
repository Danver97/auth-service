const AWS = require('aws-sdk');

const argv = process.argv.slice(2);

const region = process.env.AWS_DEFAULT_REGION || 'eu-west-2';
const environment = process.env.DEPLOY_ENVIRONMENT || 'dev';
const cloud = argv[0] || process.env.CLOUD || 'aws';

const credentials = new AWS.Credentials({
    accessKeyId: argv[1] || process.env.AWS_ACCESS_KEY_ID || '123',
    secretAccessKey: argv[2] || process.env.AWS_SECRET_ACCESS_KEY || 'xyz',
})

AWS.config = new AWS.Config({ region, credentials });

const DDB_URL = 'http://localhost:4569';
const LAMBDA_URL = 'http://localhost:4574';
const SNS_URL = 'http://localhost:4575';
const SQS_URL = 'http://localhost:4576';
const IAM_URL = 'http://localhost:4593';

let ddb;
let lambda;
let sns;
let sqs;
let iam;

function configureClients() {
    if (cloud === 'aws') {
        ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });
        lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
        sns = new AWS.SNS({ apiVersion: '2010-03-31' });
        sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
        iam = new AWS.IAM({ apiVersion: '2010-05-08' });
    } else if (cloud === 'localstack') {
        ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10', endpoint: DDB_URL });
        lambda = new AWS.Lambda({ apiVersion: '2015-03-31', endpoint: LAMBDA_URL });
        sns = new AWS.SNS({ apiVersion: '2010-03-31', endpoint: SNS_URL });
        sqs = new AWS.SQS({ apiVersion: '2012-11-05', endpoint: SQS_URL });
        iam = new AWS.IAM({ apiVersion: '2010-05-08', endpoint: IAM_URL });
    }
}

configureClients();

async function deleteTable(TableName) {
    try {
        await ddb.deleteTable({ TableName }).promise();
        console.log('Table deleted');
    } catch (err) {
        if (err.code === 'ResourceNotFoundException') {
            console.log(`Table ${TableName} does not exists`);
            return;
        }
        throw err;
    }
}

async function deleteTopic(TopicArn) {
    await sns.deleteTopic({ TopicArn }).promise();
    console.log('Topic deleted');
}

async function getTopicArn(TopicName) {
    const response = await sns.createTopic({ Name: TopicName }).promise();
    return response.TopicArn;
}

async function deleteQueue(QueueUrl) {
    try {
        await sqs.deleteQueue({ QueueUrl }).promise();
        console.log('Queue deleted');
    } catch (err) {
        console.log(err);
        if (err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
            console.log(`Queue ${QueueUrl} does not exists`);
            return;
        }
        throw err;
    }
}

async function getQueueUrl(QueueName) {
    try {
        const response = await sqs.getQueueUrl({ QueueName }).promise();
        return response.QueueUrl;
    } catch (err) {
        if (err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
            console.log(`Queue ${QueueName} does not exists`);
            return;
        }
        throw err;
    }
}

async function deleteLambda(FunctionName) {
    try {
        await lambda.deleteFunction({ FunctionName }).promise();
        console.log('Lambda deleted');
    } catch (err) {
        if (err.code === 'ResourceNotFoundException') {
            console.log(`Lambda ${FunctionName} does not exists`);
            return;
        }
        throw err;
    }
}

async function deleteStack(options = {}) {
    const TableName = options.TableName || 'TestTable';
    const QueueName = options.QueueName || 'TestQueue';
    const TopicName = options.TopicName || 'TestTopic';
    // const RoleName = options.RoleName || 'TestRole';
    const FunctionName = options.FunctionName || 'DDBStreamsToSNS';

    await deleteLambda(FunctionName);
    await deleteTable(TableName);
    const TopicArn = await getTopicArn(TopicName);
    await deleteTopic(TopicArn);
    const QueueUrl = await getQueueUrl(QueueName);
    if (QueueUrl)
        await deleteQueue(QueueUrl);

}

deleteStack({ TableName: 'authEventStreamTable' });
