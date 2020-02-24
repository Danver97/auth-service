const AWS = require('aws-sdk');
const fs = require('fs');
const AdamZip = require('adm-zip');

const region = 'eu-west-2';
const credentials = new AWS.Credentials({
    accessKeyId: '123',
    secretAccessKey: 'xyz',
})

AWS.config = new AWS.Config({ region, credentials });

const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10', endpoint: 'http://localhost:4569' });
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31', endpoint: 'http://localhost:4574' });
const sns = new AWS.SNS({ apiVersion: '2010-03-31', endpoint: 'http://localhost:4575' });
const sqs = new AWS.SQS({ apiVersion: '2012-11-05', endpoint: 'http://localhost:4576' });
const iam = new AWS.IAM({ apiVersion: '2010-05-08', endpoint: 'http://localhost:4593' });

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
    }).promise();
    console.log('Table created');
    return response;
}

async function createQueue(QueueName) {
    const response = await sqs.createQueue({
        QueueName,
    }).promise();
    console.log('Queue created');
    return response.QueueUrl;
}

async function createTopic(TopicName) {
    const response = await sns.createTopic({
        Name: TopicName,
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

async function createLambdaRole(RoleName) {
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
    RoleArn = response1.Role.Arn;

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
    return [response1, response2];
}

async function createLambda(FunctionName) {
    const data = fs.readFileSync('./test/integration-test/DDBS2SNS.js', { encoding: 'utf8' });
    const zip = new AdamZip();
    zip.addFile('DDBS2SNS.js', Buffer.alloc(data.length, data));
    const buff = zip.toBuffer();
    let response;
    try {
        response = await lambda.createFunction({
            Code: {
                ZipFile: buff,
            },
            Description: "Publish changes on items of a DynamoDB table to an SNS topic",
            FunctionName,
            Handler: "DDBS2SNS.toSNS", // is of the form of the name of your source file and then name of your function handler
            MemorySize: 128,
            Publish: true,
            Role: "arn:aws:iam::123456789012:role/service-role/role-name", // replace with the actual arn of the execution role you created
            Runtime: "nodejs12.x",
            Timeout: 3,
            VpcConfig: {
            }
        }).promise();
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

async function setupResources(options = {}) {
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
    await createLambdaRole(RoleName);
    // Create DDB Streams to SNS lambda func
    await createLambda(FunctionName);
    // Create EventMapping between DDB Streams and the previous lambda func
    await createEventSourceMapping(TableName, FunctionName);

}

setupResources({ TableName: 'authEventStreamTable' });
