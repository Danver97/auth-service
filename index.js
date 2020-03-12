const ENV = require('./lib/env');
const repo = require('./infrastructure/repository/repositoryManager')('testdb');
const queryManagerFunc = require('./infrastructure/query');
const orgMgr = new (require('./domain/logic/organizationManager'))(repo);
const userMgr = new (require('./domain/logic/userManager'))(repo);
const appFunc = require('./infrastructure/api/api');
const permChecker = require('./infrastructure/api/permissionChecker')('test');

async function run() {

    // FOR TESTING PURPOSES!!!!
    const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
    const mongod = new MongoMemoryServer();

    const mongoOptions = {
        connString: await mongod.getConnectionString(),
        dbName: 'auth-service',
        collectionName: 'auth-service',
    };
    queryMgr = await queryManagerFunc(mongoOptions);
    // !!!!


    app = appFunc({ orgManager: orgMgr, userManager: userMgr, queryManager: queryMgr, logLevel: 'err' });
    app.listen(ENV.PORT);
    console.log(`Running on port ${ENV.PORT}`);
}

run();
