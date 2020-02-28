const StackUtils = require('./stackUtils.class');

const argv = process.argv.slice(2);

const region = process.env.AWS_DEFAULT_REGION || 'eu-west-2';
const environment = process.env.DEPLOY_ENVIRONMENT || 'dev';
const cloud = argv[0] || process.env.CLOUD || 'aws';
const accountID = argv[1] || process.env.AWS_ACCOUNT_ID;

const credentials = {
    accessKeyId: argv[2] || process.env.AWS_ACCESS_KEY_ID || '123',
    secretAccessKey: argv[3] || process.env.AWS_SECRET_ACCESS_KEY || 'xyz',
};

const microserviceName = process.env.MICROSERVICE_NAME || 'provaService';

const su = new StackUtils({ accountID, region, environment, cloud, credentials });

su.createEventSourcingStack({
    TableName: `${microserviceName}EventStreamTable`,
    QueueName: `${microserviceName}Queue`,
    TopicName: `${microserviceName}Topic`,
    RoleName: `DDBS2SNSRole`,
    DDB2SNSLambdaOptions: {
        FunctionName: `${microserviceName}DDBS2SNS`,
        Handler: 'DDBS2SNS_2.toSNS',
        // envVars: {},
        path: {
            file: './test/integration-test/deployScripts/DDBS2SNS_2.js',
        }
    }
});
