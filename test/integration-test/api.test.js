const assert = require('assert');
const request = require('supertest');
const AWS = require('aws-sdk/global');
const DynamoDB = require('aws-sdk/clients/dynamodb');
const MongoClient = require('mongodb').MongoClient;
const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const testbroker = require('@danver97/event-sourcing/eventBroker')['testbroker'];
const BrokerEvent = require('@danver97/event-sourcing/eventBroker/brokerEvent');

const repoFunc = require('../../infrastructure/repository/repositoryManager');
const queryManagerFunc = require('../../infrastructure/query');
const OrganizationManager = require('../../domain/logic/organizationManager');
const UserManager = require('../../domain/logic/userManager');
const appFunc = require('../../infrastructure/api/api');
const dMongoHandlerFunc = require('../../infrastructure/denormalizers/mongodb/handler');
const dMongoWriterFunc = require('../../infrastructure/denormalizers/mongodb/writer');
const dMongoOrderCtrlFunc = require('../../infrastructure/denormalizers/mongodb/orderControl');

const User = require('../../domain/models/user.class');
const Permission = require('../../domain/models/permission.class');
const Role = require('../../domain/models/role.class');
const Organization = require('../../domain/models/organization.class');

AWS.config = new AWS.Config({ region: process.env.AWS_DEFAULT_REGION || 'eu-west-2' });
const dynamodb = new DynamoDB();
const eventSourcingTableName = `${process.env.MICROSERVICE_NAME}EventStreamTable`;
const orderControlTableName = 'DenormOrderControlTest';

const ordCtrlDB = process.env.TEST === 'integration' ? 'dynamodb' : 'testdb';
const endpoint = process.env.CLOUD === 'aws' ? undefined : 'http://localhost:4569';

const dMongoOrderCtrl = dMongoOrderCtrlFunc(ordCtrlDB, { tableName: orderControlTableName, endpoint });

const eventStoreType = (!process.env.TEST || process.env.TEST === 'unit') ? 'testdb' : 'dynamodb';
const repo = repoFunc(eventStoreType);
const orgMgr = new OrganizationManager(repo);
const userMgr = new UserManager(repo);

const mongod = new MongoMemoryServer();
let dMongoHandler;
let queryMgr;
let handlersLogLevel = 'err';
let mongoColl;

const waitAsync = ms => new Promise(resolve => setTimeout(resolve, ms));
const processEventTime = 10000;

async function setUpMongoClient(mongoOptions) {
    const mongodb = new MongoClient(mongoOptions.connString, { useNewUrlParser: true, useUnifiedTopology: true });
    await mongodb.connect();
    mongoColl = mongodb.db(mongoOptions.dbName).collection(mongoOptions.collectionName);
}

async function setUpDenormalizer(mongoOptions) {
    const dMongoWriter = await dMongoWriterFunc({ url: mongoOptions.connString, db: mongoOptions.dbName, collection: mongoOptions.collectionName });
    const dMongoHandler = await dMongoHandlerFunc(dMongoWriter, dMongoOrderCtrl, handlersLogLevel);

    await testbroker.subscribe('microservice-test');
    return dMongoHandler;
}

async function processEvents() {
    if (process.env.TEST === 'integration') {
        await waitAsync(processEventTime);
        return;
    }
    let events = await testbroker.getEvent({ number: 10 });
    if (Array.isArray(events)) {
        events = events.filter(e => e !== undefined);
        for (let e of events) {
            // console.log(e.message);
            let mongoEvent = BrokerEvent.fromObject(e);
            mongoEvent.payload = Object.assign({}, e.payload);
            /* let esEvent = BrokerEvent.fromObject(e);
            esEvent.payload = Object.assign({}, e.payload); */
            await dMongoHandler.handleEvent(mongoEvent, () => {});
            // await dESHandler.handleEvent(esEvent, () => {});
            await testbroker.destroyEvent(e);
        }
    }
}

async function setUpQuery(mongoOptions) {
    queryMgr = await queryManagerFunc(mongoOptions);
}

async function setUpData(orgName, role, user) {
    await userMgr.login(user);
    const org = await orgMgr.organizationCreated(orgName);
    await orgMgr.roleAdded(org.orgId, role);
    await orgMgr.userAdded(org.orgId, user.uniqueId);
    await orgMgr.rolesAssignedToUser(org.orgId, user.uniqueId, [role.roleId]);
    return org.orgId;
}

async function cleanUpData(orgId, userId) {
    if (!process.env.TEST || process.env.TEST === 'unit') {
        await repo.db.reset();
        await dMongoOrderCtrl.db.reset();
    } else {
        async function getEvents(streamId) {
            const ExpressionAttributeValues = { ':sid': { S: streamId } };
            const response = await dynamodb.query({ TableName: eventSourcingTableName, ExpressionAttributeValues, KeyConditionExpression: 'StreamId = :sid', ProjectionExpression: 'StreamId, EventId' }).promise();
            return response.Items;
        }
        // L'eliminazione degli eventi dell'utente è necessaria per far sì che gli eventi vengano ripubblicati e riprocessati dato che lo streamId non cambia.
        // Deletes all old events from event stream table
        // const orgIdEvents = await getEvents(orgId);
        const userIdEvents = await getEvents(userId);
        // await Promise.all(orgIdEvents.map(e => dynamodb.deleteItem({ TableName: eventSourcingTableName, Key: e }).promise()));
        await Promise.all(userIdEvents.map(e => dynamodb.deleteItem({ TableName: eventSourcingTableName, Key: e }).promise()));
        // Deletes all records about user from order control table
        await dynamodb.deleteItem({ TableName: orderControlTableName, Key: { StreamId: { S: userId } } }).promise();
    }
}

function toJSON(obj) {
    return JSON.parse(JSON.stringify(obj));
}

describe('Api unit test', function () {
    if (process.env.TEST === 'integration') {
        this.timeout(40000);
        this.slow(10000);
    }
    let user1 = new User({
        accountId: 14546434341331,
        accountType: 'Google',
        firstname: 'Christian',
        lastname: 'Paesante',
        email: 'chri.pae@gmail.com',
    });
    let user2 = new User({
        accountId: 14546434341332,
        accountType: 'Google',
        firstname: 'John',
        lastname: 'Doe',
        email: 'john.doe@gmail.com',
    });
    const perm1 = new Permission('auth-service', 'addRole');
    const perm2 = new Permission('auth-service', 'removeRole');
    let role1 = new Role('waiter1', [perm1]);
    let role2 = new Role('waiter2', [perm2]);
    const orgName1 = 'Risto1';
    const orgName2 = 'Risto2';
    let orgId1 = ':orgId';

    before(async () => {
        let mongoOptions;
        if (!process.env.TEST || process.env.TEST === 'unit') {
            mongoOptions = {
                connString: await mongod.getConnectionString(),
                dbName: 'auth',
                collectionName: 'auth',
            };
        } else {
            mongoOptions = {
                connString: process.env.MONGODB_URL,
                dbName: process.env.MONGODB_DBNAME,
                collectionName: process.env.MONGODB_COLLECTION,
            };            
        }
        await setUpMongoClient(mongoOptions);
        dMongoHandler = await setUpDenormalizer(mongoOptions);
        await setUpQuery(mongoOptions);
        app = appFunc(orgMgr, userMgr, queryMgr, 'err');
        req = request(app);
    });

    beforeEach(async () => {
        role1 = new Role('waiter1', [perm1]);
        role2 = new Role('waiter2', [perm2]);
        user1 = new User({
            accountId: 14546434341331,
            accountType: 'Google',
            firstname: 'Christian',
            lastname: 'Paesante',
            email: 'chri.pae@gmail.com',
        });
        user2 = new User({
            accountId: 14546434341332,
            accountType: 'Google',
            firstname: 'John',
            lastname: 'Doe',
            email: 'john.doe@gmail.com',
        });

        orgId1 = await setUpData(orgName1, role1, user1);
        await processEvents();
    });

    afterEach(async () => {
        await cleanUpData(orgId1, user1.uniqueId);
        await mongoColl.deleteMany({});
    });

    it('service test', async function () {
        await req.get('/service')
            .expect(JSON.stringify({
                service: 'auth-service',
            }));
    });

    it('POST\t/organizations', async function () {
        await req.post('/organizations')
            .set('Content-Type', 'application/json')
            .send({ name: orgName2 })
            .expect(200);
    });

    it(`GET\t/organizations/${orgId1}`, async function () {
        await req.get(`/organizations/blablabla`)
            .expect(404);
        await req.get(`/organizations/${orgId1}`)
            .expect(res => {
                const data = res.body.data;
                const links = res.body.links;
                const expectedData = {
                    _id: orgId1,
                    orgId: orgId1,
                    name: orgName1,
                    _type: 'organization',
                    /* // This is due to the fact that there's no way to specify to include this fields in the query
                    // This fields are not projected because they will be 2 ever-growing lists
                    roles: [],
                    users: [], */
                };
                const expectedLinks = {
                    self: `/organizations/${orgId1}`,
                    roles: `/organizations/${orgId1}/roles`,
                    users: `/organizations/${orgId1}/users`,
                }
                assert.deepStrictEqual(data, expectedData);
                assert.deepStrictEqual(links, expectedLinks);
            })
            .expect(200);
    });

    it(`GET\t/organizations/${orgId1}/roles`, async function () {
        await req.get(`/organizations/blablabla/roles`)
            .expect(404);
        await req.get(`/organizations/${orgId1}/roles`)
            .expect(res => {
                role1._id = role1.roleId;
                role1.orgId = orgId1;
                role1._type = 'role';
                const expected = [{
                    data: role1,
                    links: {
                        organization: `/organizations/${orgId1}`,
                        self: `/organizations/${orgId1}/roles/${role1.roleId}`,
                    }
                }]
                assert.ok(Array.isArray(res.body));
                assert.deepStrictEqual(res.body, toJSON(expected));
            })
            .expect(200);
    });

    it(`POST\t/organizations/${orgId1}/roles`, async function () {
        await req.post(`/organizations/blablabla/roles`)
            .expect(400);
        await req.post(`/organizations/blablabla/roles`)
            .send(role2)
            .expect(404);
        await req.post(`/organizations/${orgId1}/roles`)
            .set('Content-Type', 'application/json')
            .send(role2)
            .expect(res => {
                role2.roleId = res.body.data.roleId;
                const expected = {
                    data: role2,
                    links: {
                        organization: `/organizations/${orgId1}`,
                        self: `/organizations/${orgId1}/roles/${role2.roleId}`,
                    }
                };
                assert.deepStrictEqual(res.body, toJSON(expected));
            })
            .expect(200);
    });

    it(`GET\t/organizations/${orgId1}/roles/${role1.roleId}`, async function () {
        await req.get(`/organizations/blablabla/roles/${role1.roleId}`)
            .expect(404);
        await req.get(`/organizations/${orgId1}/roles/blablabla`)
            .expect(404);
        await req.get(`/organizations/${orgId1}/roles/${role1.roleId}`)
            .expect(res => {
                role1._id = role1.roleId;
                role1.orgId = orgId1;
                role1._type = 'role';
                const expected = {
                    data: role1,
                    links: {
                        organization: `/organizations/${orgId1}`,
                        self: `/organizations/${orgId1}/roles/${role1.roleId}`,
                    }
                }
                assert.deepStrictEqual(res.body, toJSON(expected));
            })
            .expect(200);
    });

    it(`PUT\t/organizations/${orgId1}/roles/${role1.roleId}`, async function () {
        await req.put(`/organizations/${orgId1}/roles/${role1.roleId}`)
            .expect(400);
        await req.put(`/organizations/blablabla/roles/${role1.roleId}`)
            .set('Content-Type', 'application/json')
            .send({ name: 'newName', permissions: [perm2] })
            .expect(404);
        await req.put(`/organizations/${orgId1}/roles/blablabla`)
            .set('Content-Type', 'application/json')
            .send({ name: 'newName', permissions: [perm2] })
            .expect(404);
        await req.put(`/organizations/${orgId1}/roles/${role1.roleId}`)
            .set('Content-Type', 'application/json')
            .send({ name: 'newName', permissions: [perm2] }) // Something here!
            /* .expect(res => {
                role1._id = role1.roleId;
                role1.orgId = orgId1;
                role1.name = 'newName';
                role1.permissions = [perm2];
                role1._type = 'role';
                const expected = {
                    data: role1,
                    links: {
                        organization: `/organizations/${orgId1}`,
                        self: `/organizations/${orgId1}/roles/${role1.roleId}`,
                    }
                }
                assert.deepStrictEqual(res.body, toJSON(expected));
            }) */
            .expect(200);
    });

    it(`DELETE\t/organizations/${orgId1}/roles/${role1.roleId}`, async function () {
        await req.delete(`/organizations/blablabla/roles/${role1.roleId}`)
            .expect(404);
        await req.delete(`/organizations/${orgId1}/roles/blablabla`)
            .expect(404);
        await req.delete(`/organizations/${orgId1}/roles/${role1.roleId}`)
            .expect(200);
    });

    it(`GET\t/organizations/${orgId1}/users`, async function () {        
        await req.get(`/organizations/blablabla/users`)
            .expect(404);
        await req.get(`/organizations/${orgId1}/users`)
            .expect(res => {
                const userExpected = Object.assign({}, user1);
                userExpected._id = user1.uniqueId;
                userExpected.uniqueId = user1.uniqueId;
                userExpected.fullname = user1.fullname;
                userExpected._type = 'user';
                userExpected.organizations = [orgId1];
                userExpected.roles = { [orgId1]: [role1.roleId] };
                const expected = [{
                    data: userExpected,
                    links: {
                        self: `/users/${userExpected.uniqueId}`,
                    }
                }];
                assert.ok(Array.isArray(res.body));
                assert.deepStrictEqual(res.body, expected);
            })
            .expect(200);
    });

    it(`POST\t/organizations/${orgId1}/users`, async function () {
        await req.post(`/organizations/blablabla/users`)
            .expect(400);
        await req.post(`/organizations/blablabla/users`)
            .send({ userId: user1.uniqueId })
            .expect(404);
        await req.post(`/organizations/${orgId1}/users`)
            .send({ userId: user1.uniqueId })
            .expect(400);
        await req.post(`/organizations/${orgId1}/users`)
            .set('Content-Type', 'application/json')
            .send({ userId: user2.uniqueId })
            .expect(200);
    });

    it(`DELETE\t/organizations/${orgId1}/users/${user1.uniqueId}`, async function () {
        await req.delete(`/organizations/blablabla/users/${user1.uniqueId}`)
            .expect(404);
        await req.delete(`/organizations/${orgId1}/users/${user2.uniqueId}`)
            .expect(404);
        await req.delete(`/organizations/${orgId1}/users/${user1.uniqueId}`)
            .expect(200);
    });

    it(`GET\t/organizations/${orgId1}/users/${user1.uniqueId}/roles`, async function () {
        await req.get(`/organizations/blablabla/roles/${user1.uniqueId}/roles`)
            .expect(404);
        await req.get(`/organizations/${orgId1}/users/blablabla/roles`)
            .expect(404);
        await req.get(`/organizations/${orgId1}/users/${user1.uniqueId}/roles`)
            .expect(res => {
                role1._id = role1.roleId;
                role1.orgId = orgId1;
                role1._type = 'role';
                const expected = [{
                    data: role1,
                    links: {
                        organization: `/organizations/${orgId1}`,
                        self: `/organizations/${orgId1}/roles/${role1.roleId}`,
                    }
                }];
                assert.deepStrictEqual(res.body, toJSON(expected));
            })
            .expect(200);
    });

    it(`POST\t/organizations/${orgId1}/users/${user1.uniqueId}/roles`, async function () {

        await req.post(`/organizations/${orgId1}/users/${user1.uniqueId}/roles`)
            .expect(400);
        await req.post(`/organizations/blablabla/roles/${user1.uniqueId}/roles`)
            .send({ rolesIds: [role2.roleId] })
            .expect(404);
        await req.post(`/organizations/${orgId1}/users/blablabla/roles`)
            .send({ rolesIds: [role2.roleId] })
            .expect(404);
        await req.post(`/organizations/${orgId1}/users/${user1.uniqueId}/roles`)
            .send({ rolesIds: [role2.roleId] })
            .expect(404);
        
        // Preset
        await orgMgr.roleAdded(orgId1, role2);
        // Actual request
        await req.post(`/organizations/${orgId1}/users/${user1.uniqueId}/roles`)
            .send({ rolesIds: [role2.roleId] })
            .expect(200);
    });

    it(`DELETE\t/organizations/${orgId1}/users/${user1.uniqueId}/roles/${role1.roleId}`, async function () {
        await req.delete(`/organizations/blablabla/users/${user1.uniqueId}/roles/${role1.roleId}`)
            .expect(404);
        await req.delete(`/organizations/${orgId1}/users/${user1.uniqueId}/roles/blablabla`)
            .expect(404);
        await req.delete(`/organizations/${orgId1}/users/${user1.uniqueId}/roles/${role2.roleId}`)
            .expect(404);
        // Actual request
        await req.delete(`/organizations/${orgId1}/users/${user1.uniqueId}/roles/${role1.roleId}`)
            .expect(200);
    });

    it.skip(`POST\t/login`, async function () {
        await req.post(`/login`)
            .set('Content-Type', 'application/json')
            .send({ id_token: 'blabla' })
            .expect(res => {
                console.log(res.body);
            })
            .expect(400);
    });

});
