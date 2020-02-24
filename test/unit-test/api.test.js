const assert = require('assert');
const request = require('supertest');
const MongoClient = require('mongodb').MongoClient;
const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const testbroker = require('@danver97/event-sourcing/eventBroker')['testbroker'];
const BrokerEvent = require('@danver97/event-sourcing/eventBroker/brokerEvent');

const repo = require('../../infrastructure/repository/repositoryManager')('testdb');
const queryManagerFunc = require('../../infrastructure/query');
const orgMgr = new (require('../../domain/logic/organizationManager'))(repo);
const userMgr = new (require('../../domain/logic/userManager'))(repo);
const appFunc = require('../../infrastructure/api/api');
const dMongoHandlerFunc = require('../../infrastructure/denormalizers/mongodb/handler');
const dMongoWriterFunc = require('../../infrastructure/denormalizers/mongodb/writer');
const dMongoOrderCtrl = require('../../infrastructure/denormalizers/mongodb/orderControl')('testdb');

const User = require('../../domain/models/user.class');
const Permission = require('../../domain/models/permission.class');
const Role = require('../../domain/models/role.class');
const Organization = require('../../domain/models/organization.class');

const mongod = new MongoMemoryServer();
let dMongoHandler;
let queryMgr;
let handlersLogLevel = 'err';
let mongoColl;


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

function toJSON(obj) {
    return JSON.parse(JSON.stringify(obj));
}

describe('Api unit test', function () {
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
    let orgId1;

    before(async () => {
        const mongoOptions = {
            connString: await mongod.getConnectionString(),
            dbName: 'auth-service',
            collectionName: 'auth-service',
        };
        await setUpMongoClient(mongoOptions);
        dMongoHandler = await setUpDenormalizer(mongoOptions);
        await setUpQuery(mongoOptions);
        app = appFunc(orgMgr, userMgr, queryMgr, 'err');
        req = request(app);
        orgId1 = await setUpData(orgName1, role1, user1);
        await processEvents();
    });

    beforeEach(async () => {
        await repo.db.reset();
        await dMongoOrderCtrl.db.reset();
        await mongoColl.deleteMany({});

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

    afterEach(() => processEvents());

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
