const AWS = require('aws-sdk');
const fs = require('fs');
const AdamZip = require('adm-zip');

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

async function buildTable(TableName) {
    const RCU = 5;
    const WCU = 5;
    const response = await ddb.createTable({
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
                Value: environment,
            },
        ]
    }).promise();
    console.log('Table created');
    return response;
}

async function createQueue(QueueName) {
    const response = await sqs.createQueue({
        QueueName,
        tags: {
            Environment: environment
        }
    }).promise();
    console.log('Queue created');
    return response.QueueUrl;
}

async function createTopic(TopicName) {
    const response = await sns.createTopic({
        Name: TopicName,
        Tags: [
            {
                Key: 'Environment',
                Value: environment,
            },
        ]
    }).promise();
    console.log('Topic created');
    return response.TopicArn;
}

async function getQueueArn(QueueUrl) {
    const response = await sqs.getQueueAttributes(params = {
        QueueUrl, /* required */
        AttributeNames: ['QueueArn'],
    }).promise();
    return response.Attributes.QueueArn;
}

async function subscribeQueueToTopic(TopicArn, QueueArn) {
    const response = await sns.subscribe({
        Protocol: 'sqs',
        TopicArn,
        Endpoint: QueueArn,
        ReturnSubscriptionArn: true
    }).promise();
    console.log('Queue subscribed to Topic');
    return response;
}

async function createLambdaRole(RoleName, FunctionName, TableName) {
    try {
        const response = await iam.getRole({ RoleName }).promise();
        console.log('Lambda Role already exists');
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
        response1 = await iam.createRole({
            AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicy),
            RoleName,
        }).promise();
    } catch (err) {
        if (err.code === 'EntityAlreadyExists') {
            console.log('Role already exists');
            return;
        }
        throw err;
    }
    const RoleArn = response1.Role.Arn;

    const accountID = 'accountID';
    const rolePolicy = {
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Action: "lambda:InvokeFunction",
                Resource: `arn:aws:lambda:${region}:${accountID}:function:${FunctionName}*`
            },
            {
                Effect: "Allow",
                Action: [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
                Resource: `arn:aws:logs:${region}:${accountID}:*`
            },
            {
                Effect: "Allow",
                Action: [
                    "dynamodb:DescribeStream",
                    "dynamodb:GetRecords",
                    "dynamodb:GetShardIterator",
                    "dynamodb:ListStreams"
                ],
                Resource: `arn:aws:dynamodb:${region}:${accountID}:table/${TableName}/stream/*`
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
    const response2 = await iam.putRolePolicy({
        PolicyDocument: JSON.stringify(rolePolicy),
        PolicyName: "DDBS2SNSAccessPolicy",
        RoleName,
    }).promise();
    console.log('Lambda Role created');
    return RoleArn;
}

async function createLambda(FunctionName, TopicArn, RoleArn) {
    const data = fs.readFileSync('./test/integration-test/DDBS2SNS_2.js', { encoding: 'utf8' });
    // console.log(data);
    const zip = new AdamZip();
    zip.addFile('DDBS2SNS.js', Buffer.alloc(data.length, data));
    const buff = zip.toBuffer();
    let response;
    try {
        const params = {
            Code: {
                ZipFile: buff,
            },
            Description: "Publish changes on items of a DynamoDB table to an SNS topic",
            FunctionName,
            Handler: "DDBS2SNS.toSNS", // is of the form of the name of your source file and then name of your function handler
            MemorySize: 128,
            Publish: true,
            Role: RoleArn, // replace with the actual arn of the execution role you created
            Runtime: "nodejs10.x",
            Timeout: 3,
            Environment: {
                Variables: {
                    SNS_URL,
                    TOPIC_ARN: TopicArn,
                    AWS_ACCESS_KEY_ID: credentials.accessKeyId,
                    AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
                    AWS_DEFAULT_REGION: region,
                }
            },
            Tags: {
                Environment: environment,
            }
        };
        if (cloud === 'localstack')
            params.Environment.Variables.SNS_URL = SNS_URL;
        response = await lambda.createFunction(params).promise();
    } catch (err) {
        if (err.code === 'ResourceConflictException') {
            console.log('Function already exist: DDBStreamsToSNS');
            return;
        }
        throw err;
    }
    console.log('Lambda created');
    return response;
}

async function createEventSourceMapping(TableName, FunctionName) {
    const response1 = await ddb.describeTable({ TableName }).promise();
    const StreamArn = response1.Table.LatestStreamArn;
    const response2 = await lambda.createEventSourceMapping({
        EventSourceArn: StreamArn, /* required */
        FunctionName, /* required */
        BatchSize: 1000,
        StartingPosition: 'LATEST',
    }).promise();
    console.log('EventSourceMapping created');
}

async function publishToSNS(TopicArn) {
    const response = await sns.publish({
        Message: 'Hello',
        TopicArn,
    }).promise();
    return response;
}

async function invokeLambda(FunctionName) {
    const testEvent = {
        "Records": [
            {
                "eventID": "1",
                "eventVersion": "1.0",
                "dynamodb": {
                    "Keys": {
                        "StreamId": {
                            "S": "1"
                        },
                        "EventId": {
                            "N": "1"
                        }
                    },
                    "NewImage": {
                        "Payload": {
                            "M": {
                                "Field": {
                                    "S": "Field!"
                                }
                            }
                        },
                        "Message": {
                            "S": "New event!"
                        },
                        "StreamId": {
                            "S": "1"
                        },
                        "EventId": {
                            "N": "1"
                        }
                    },
                    "StreamViewType": "NEW_AND_OLD_IMAGES",
                    "SequenceNumber": "111",
                    "SizeBytes": 26
                },
                "awsRegion": "us-west-2",
                "eventName": "INSERT",
                "eventSourceARN": "eventsourcearn",
                "eventSource": "aws:dynamodb"
            }
        ]
    };
    const response = await lambda.invoke({
        FunctionName,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
        Payload: JSON.stringify(testEvent),
    }).promise();
}

async function createStack(options = {}) {
    const TableName = options.TableName || 'TestTable';
    const QueueName = options.QueueName || 'TestQueue';
    const TopicName = options.TopicName || 'TestTopic';
    const RoleName = options.RoleName || 'TestRole';
    const FunctionName = options.FunctionName || 'DDBStreamsToSNS';

    await buildTable(TableName);
    const TopicArn = await createTopic(TopicName);
    const QueueUrl = await createQueue(QueueName);
    const QueueArn = await getQueueArn(QueueUrl);
    await subscribeQueueToTopic(TopicArn, QueueArn);
    // Create lambda role
    const RoleArn = await createLambdaRole(RoleName, FunctionName, TableName);
    // Create DDB Streams to SNS lambda function
    await createLambda(FunctionName, TopicArn, RoleArn);
    // Create EventMapping between DDB Streams and the previous lambda function
    await createEventSourceMapping(TableName, FunctionName);
    // console.log(await invokeLambda(FunctionName));
    // console.log(await publishToSNS(TopicArn));

}

createStack({ TableName: 'authEventStreamTable' });
