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

const su = new StackUtils({ accountID, region, environment, cloud, credentials });

const InstanceId = argv[4] || process.env.INSTANCE_ID;
const EventSourceMappingUUID = argv[5] || process.env.ESM_UUID;

async function deleteDenormalizerStack(InstanceId, EventSourceMappingUUID) {
    if (!InstanceId)
        throw new Error('Missing InstanceId parameter');
    const QueueName = 'DenormTestQueue';
    const KeyName = 'DenormTestKeys';
    const OrderControlTableName = 'DenormOrderControlTest';
    const LambdaFunctionName = 'DenormMongoDBTest';
    
    await su.deleteDenormalizerStack({ QueueName, OrderControlTableName, EventSourceMappingUUID, lambdaDeployed: true, lambdaOptions: { FunctionName: LambdaFunctionName } });
    await su.stopMongoInstance(KeyName, InstanceId);
}
deleteDenormalizerStack(InstanceId, EventSourceMappingUUID);
