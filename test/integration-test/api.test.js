// #region Imports
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

// const defaultRoles = require('../../domain/defaultRoles');
const checkPerm = require('../../infrastructure/api/permissionChecker');

const User = require('../../domain/models/user.class');
const Permission = require('../../domain/models/permission.class');
const Role = require('../../domain/models/role.class');
const PermissionDefinition = require('../../domain/models/permissionDef.class');
const RoleDefinition = require('../../domain/models/roleDef.class');
const RoleInstance = require('../../domain/models/roleInstance.class');
const Organization = require('../../domain/models/organization.class');
// #endregion

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
const processEventTime = 12000;

//#region Setup and Utils functions

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

async function setUpData(orgName, roleDefOptions = {}, user) {
    await userMgr.login(user);
    const org = await orgMgr.organizationCreated(orgName);
    if (!roleDefOptions.roleId)
        roleDefOptions.orgId = org.orgId;
    const roleDef = new RoleDefinition(roleDefOptions);
    await orgMgr.roleDefinitionAdded(org.orgId, roleDef);
    await orgMgr.userAdded(org.orgId, user.uniqueId);
    let roleInstance = new RoleInstance({ roleDef, paramValues: { orgId: org.orgId } });
    await orgMgr.rolesAssignedToUser(org.orgId, user.uniqueId, [roleInstance.toJSON()]);
    return { orgId: org.orgId, roleDef, roleInstance };
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
//#endregion

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
    let authorizedUser;
    let authorizedToken;
    const perm1 = new Permission('auth-service', 'addRole');
    const perm2 = new Permission('auth-service', 'removeRole');
    let role1 = new Role('waiter1', [perm1]);
    let role2 = new Role('waiter2', [perm2]);
    const permDef1 = new PermissionDefinition({
        scope: 'reservation-service', name: 'acceptReservation', parameters: {
            orgId: { name: 'OrganizationId', description: 'The id of the organization the user belongs to', required: true },
            restId: { name: 'RestaurantId', description: 'The id of the restaurant', required: false },
        }
    });
    const permDef2 = new PermissionDefinition({
        scope: 'reservation-service', name: 'listReservation', parameters: {
            orgId: { name: 'OrganizationId', description: 'The id of the organization the user belongs to', required: true },
            restId: { name: 'RestaurantId', description: 'The id of the restaurant', required: false },
        }
    });
    const roleDefOptions = {
        name: 'Waiter',
        description: 'Waiter of the restaurant',
        permissions: [permDef1],
        paramMapping: {
            'orgId': {
                name: 'OrganizationId',
                description: 'The id of the organization the user belongs to',
                mapping: [`${permDef1.scope}:${permDef1.name}:orgId`],
            },
            'restId': {
                mapping: `${permDef1.scope}:${permDef1.name}:restId`,
            },
        }
    };
    let roleDefOptions2;
    let roleDef;
    let roleInstance;
    const orgName1 = 'Risto1';
    const orgName2 = 'Risto2';
    let orgId1 = ':orgId';

    before(async function () {
        this.timeout(20000);
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
        await checkPerm.init();
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
        roleDefOptions2 = {
            name: 'Waiter',
            description: 'Waiter of the restaurant',
            permissions: [permDef1],
            paramMapping: {
                'orgId': {
                    name: 'OrganizationId',
                    description: 'The id of the organization the user belongs to',
                    mapping: [`${permDef1.scope}:${permDef1.name}:orgId`, `${permDef2.scope}:${permDef2.name}:orgId`],
                },
                'restId': {
                    mapping: [`${permDef1.scope}:${permDef1.name}:restId`, `${permDef2.scope}:${permDef2.name}:restId`],
                },
            }
        }

        const results = await setUpData(orgName1, roleDefOptions, user1);
        orgId1 = results.orgId;
        roleDef = results.roleDef;
        roleInstance = results.roleInstance;

        /* authorizedUser = new User({
            accountId: 14546434341332,
            accountType: 'Google',
            firstname: 'John',
            lastname: 'Doe',
            email: 'john.doe@gmail.com',
            roles: {
                [orgId1]: defaultRoles.filter(r => r.name === 'OrganizationOwner')
            },
        });
        authorizedToken = await checkPerm.signJWT(authorizedUser); */
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
                const expectRoleDef = toJSON(roleDef);
                expectRoleDef._id = expectRoleDef.roleDefId;
                expectRoleDef.orgId = orgId1;
                expectRoleDef._type = 'roleDef';
                const expected = [{
                    data: expectRoleDef,
                    links: {
                        organization: `/organizations/${orgId1}`,
                        self: `/organizations/${orgId1}/roles/${expectRoleDef.roleDefId}`,
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
            .send(roleDefOptions2)
            .expect(404);
        await req.post(`/organizations/${orgId1}/roles`)
            .set('Content-Type', 'application/json')
            .send(roleDefOptions2)
            .expect(res => {
                roleDefOptions2.roleDefId = res.body.data.roleDefId;
                roleDefOptions2.orgId = orgId1;
                const expected = {
                    data: roleDefOptions2,
                    links: {
                        organization: `/organizations/${orgId1}`,
                        self: `/organizations/${orgId1}/roles/${roleDefOptions2.roleDefId}`,
                    }
                };
                assert.deepStrictEqual(res.body, toJSON(expected));
            })
            .expect(200);
    });

    it(`GET\t/organizations/${orgId1}/roles/:roleDefId`, async function () {
        await req.get(`/organizations/blablabla/roles/${roleDef.roleDefId}`)
            .expect(404);
        await req.get(`/organizations/${orgId1}/roles/blablabla`)
            .expect(404);
        await req.get(`/organizations/${orgId1}/roles/${roleDef.roleDefId}`)
            .expect(res => {
                const expectedRoleDef = toJSON(roleDef);
                expectedRoleDef._id = expectedRoleDef.roleDefId;
                expectedRoleDef.orgId = orgId1;
                expectedRoleDef._type = 'roleDef';
                const expected = {
                    data: expectedRoleDef,
                    links: {
                        organization: `/organizations/${orgId1}`,
                        self: `/organizations/${orgId1}/roles/${expectedRoleDef.roleDefId}`,
                    }
                }
                assert.deepStrictEqual(res.body, toJSON(expected));
            })
            .expect(200);
    });

    it(`PUT\t/organizations/${orgId1}/roles/:roleDefId`, async function () {
        await req.put(`/organizations/${orgId1}/roles/${roleDef.roleDefId}`)
            .expect(400);
        await req.put(`/organizations/blablabla/roles/${roleDef.roleDefId}`)
            .set('Content-Type', 'application/json')
            .send({ name: 'newName', permissions: [permDef2] })
            .expect(404);
        await req.put(`/organizations/${orgId1}/roles/blablabla`)
            .set('Content-Type', 'application/json')
            .send({ name: 'newName', permissions: [permDef2] })
            .expect(404);
        await req.put(`/organizations/${orgId1}/roles/${roleDef.roleDefId}`)
            .set('Content-Type', 'application/json')
            .send({ name: 'newName', paramMapping: {
                'orgId': {
                    name: 'OrganizationId',
                    description: 'The id of the organization the user belongs to',
                    mapping: [`${permDef1.scope}:${permDef1.name}:orgId`, `${permDef2.scope}:${permDef2.name}:orgId`],
                },
                'restId': {
                    mapping: `${permDef1.scope}:${permDef1.name}:restId`,
                },
            }, permissions: [permDef2] }) // Something here!
            .expect(200);
    });

    it(`DELETE\t/organizations/${orgId1}/roles/:roleDefId`, async function () {
        await req.delete(`/organizations/blablabla/roles/${roleDef.roleDefId}`)
            .expect(404);
        await req.delete(`/organizations/${orgId1}/roles/blablabla`)
            .expect(404);
        await req.delete(`/organizations/${orgId1}/roles/${roleDef.roleDefId}`)
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
                userExpected.roles = { [orgId1]: [roleInstance] };
                const expected = [{
                    data: userExpected,
                    links: {
                        self: `/users/${userExpected.uniqueId}`,
                    }
                }];
                assert.ok(Array.isArray(res.body));
                assert.deepStrictEqual(res.body, toJSON(expected));
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
                roleInstance.orgId = orgId1;
                const expected = [{
                    data: roleInstance,
                    links: {
                        organization: `/organizations/${orgId1}`,
                        self: `/organizations/${orgId1}/roles/${roleInstance.id}`,
                    }
                }];
                assert.deepStrictEqual(res.body, toJSON(expected));
            })
            .expect(200);
    });

    it(`POST\t/organizations/${orgId1}/users/${user1.uniqueId}/roles`, async function () {

        await req.post(`/organizations/${orgId1}/users/${user1.uniqueId}/roles`)
            .expect(400);
        await req.post(`/organizations/${orgId1}/users/${user1.uniqueId}/roles`)
            .send({ roles: ['string'] })
            .expect(400);
        await req.post(`/organizations/${orgId1}/users/${user1.uniqueId}/roles`)
            .send({ roles: [{}] })
            .expect(400);
        await req.post(`/organizations/blablabla/roles/${user1.uniqueId}/roles`)
            .send({ roles: [roleInstance.toJSON()] })
            .expect(404);
        await req.post(`/organizations/${orgId1}/users/blablabla/roles`)
            .send({ roles: [roleInstance.toJSON()] })
            .expect(404);
        await req.post(`/organizations/${orgId1}/users/${user1.uniqueId}/roles`)
            .send({ roles: [{ roleDefId: 'notExistent' }] })
            .expect(400);
        await req.post(`/organizations/${orgId1}/users/${user1.uniqueId}/roles`)
            .send({ roles: [roleInstance.toJSON()] })
            .expect(200);

        // Preset
        roleDefOptions2.orgId = orgId1;
        const roleDef2 = new RoleDefinition(roleDefOptions2)
        await orgMgr.roleDefinitionAdded(orgId1, roleDef2);
        const roleInstance2 = new RoleInstance({ roleDef: roleDef2, paramValues: { orgId: orgId1 } });
        // Actual request
        await req.post(`/organizations/${orgId1}/users/${user1.uniqueId}/roles`)
            .send({ roles: [roleInstance2.toJSON()] })
            .expect(200);
    });

    it(`DELETE\t/organizations/${orgId1}/users/${user1.uniqueId}/roles/:roleDefId`, async function () {
        await req.delete(`/organizations/blablabla/users/${user1.uniqueId}/roles/${roleDef.roleDefId}`)
            .expect(404);
        await req.delete(`/organizations/${orgId1}/users/${user1.uniqueId}/roles/blablabla`)
            .expect(404);
        // Actual request
        await req.delete(`/organizations/${orgId1}/users/${user1.uniqueId}/roles/${roleDef.roleDefId}`)
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
