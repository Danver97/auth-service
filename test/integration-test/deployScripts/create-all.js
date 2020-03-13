// const Core = require('../../../lib/scripts/Core.class');
// const Projection = require('../../../lib/scripts/Projection.class');
const Core = require('@danver97/event-sourcing/deployScripts/Core.class')
const Projection = require('@danver97/event-sourcing/deployScripts/Projection.class')

const region = process.env.AWS_DEFAULT_REGION || 'eu-west-2';
const credentials = {
    accessKeyId: process.env.DEPLOY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.DEPLOY_AWS_SECRET_ACCESS_KEY,
};
const environment = process.env.DEPLOY_ENVIRONMENT || 'dev';
const microserviceName = process.env.MICROSERVICE_NAME;

const core = new Core({
    region,
    credentials,
    environment,
    microserviceName,
    TableName: `${microserviceName}EventStreamTable`,
    TopicName: `${microserviceName}Topic`,
    QueueName: `${microserviceName}Queue`,
});

const proj = new Projection({
    region,
    credentials,
    environment,
    microserviceName,
    TableName: 'DenormOrderControlTest',
    QueueName: 'DenormTestQueue',
    Lambda: {
        FunctionName: 'DenormMongoDBTest',
        RoleName: 'denormalizerRole',
        Handler: 'index.mongoDenormalizer',
        package: {
            folder: './infrastructure/denormalizers/mongodb'
        },
    },
    deployProjectionDB: true,
    ProjectionDB: {
        Type: 'mongodb-ec2',
    }
});
async function run() {
    await core.build();
    await proj.build();
    console.log('MongoDB url:', proj.ProjectionDB.mongoConnString);
    await proj.deploy({
        envVars: {
            ORDER_CONTROL_DB: 'dynamodb',
            ORDER_CONTROL_TABLE: proj.TableName,
            MONGODB_URL: proj.ProjectionDB.mongoConnString,
            MONGODB_DBNAME: 'authTest',
            MONGODB_COLLECTION: 'authTest',
        }
    });
    await proj.subscribe(core);
    core.serialize();
    proj.serialize();
}

run();
