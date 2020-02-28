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
const logLevel = argv[4] || process.env.LOG_LEVEL;

const su = new StackUtils({ accountID, region, environment, cloud, credentials, logLevel: logLevel || 'noLog' });

async function createDenormalizerStack() {
    const TopicName = `${microserviceName}Topic`;
    const QueueName = 'DenormTestQueue';
    const KeyName = 'DenormTestKeys';
    const LaunchTemplateName = 'MongoDBTemplate';
    const OrderControlTableName = 'DenormOrderControlTest';
    const LambdaFunctionName = 'DenormMongoDBTest';

    const { InstanceId, InstanceDNS, mongoCredentials } = await su.launchMongoInstance(KeyName, LaunchTemplateName);
    // await su.stopMongoInstance(KeyName, InstanceId);
    if (!mongoCredentials) 
        throw new Error('Unable to get mongo credentials.');

    const ESMUUID = await su.createDenormalizerStack({ TopicName, QueueName, OrderControlTableName, deployLambda: true, lambdaOptions: {
        FunctionName: LambdaFunctionName,
        Handler: 'index.mongoDenormalizer',
        envVars: {
            ORDER_CONTROL_DB: 'dynamodb',
            ORDER_CONTROL_TABLE: OrderControlTableName,
            MONGODB_URL: `mongodb://${mongoCredentials.user}:${mongoCredentials.password}@${InstanceDNS}:27017`,
            MONGODB_DBNAME: 'authTest',
            MONGODB_COLLECTION: 'authTest',
        }
    }, deploymentPackageOptions: { folder: './infrastructure/denormalizers/mongodb'} });

    console.log('Denormalizer stack created');
    console.log('InstanceId:', InstanceId);
    console.log('InstanceDNS:', InstanceDNS);
    console.log('mongoCredentials:', mongoCredentials);
    console.log('mongoUrl:', `mongodb://${mongoCredentials.user}:${mongoCredentials.password}@${InstanceDNS}:27017`);
    console.log('EventSourceMappingUUID:', ESMUUID);

    return { InstanceId, InstanceDNS, mongoCredentials, EventSourceMappingUUID: ESMUUID };

}
createDenormalizerStack();
