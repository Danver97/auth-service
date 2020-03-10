const assert = require('assert');
const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const MongoClient = require('mongodb').MongoClient;
const queryMgrFunc = require('../../../infrastructure/query');
const QueryError = require('../../../infrastructure/query/query.error');
const RoleDefinition = require('../../../domain/models/roleDef.class');
const RoleInstance = require('../../../domain/models/roleInstance.class');
const data = require('./collection.json');

const mongod = new MongoMemoryServer();
let client = null;
let collection = null;
let queryMgr = null;

function toJSON(obj) {
    return JSON.parse(JSON.stringify(obj));
}

const docTypes = {
    organization: 'organization',
    role: 'role',
    roleDef: 'roleDef',
    user: 'user',
};

describe('Query Manager unit test', function () {
    if (process.env.TEST === 'integration') {
        this.timeout(5000);
        this.slow(500);
    }
    let users;
    let orgs;
    let roles;

    before(async function () {
        this.timeout(10000);
        let mongoConfig;
        if (!process.env.TEST || process.env.TEST === 'unit') {
            mongoConfig = {
                connString: await mongod.getConnectionString(),
                dbName: 'auth',
                collectionName: 'auth',
            };
        } else {
            mongoConfig = {
                connString: process.env.MONGODB_URL,
                dbName: process.env.MONGODB_DBNAME,
                collectionName: process.env.MONGODB_COLLECTION,
            };            
        }
        console.log(mongoConfig.connString);
        client = new MongoClient(mongoConfig.connString, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        collection = client.db(mongoConfig.dbName).collection(mongoConfig.collectionName);
        queryMgr = await queryMgrFunc(mongoConfig);
        await collection.insertMany(data);
    });

    beforeEach(() => {
        users = toJSON(data.filter(d => d._type === docTypes.user));
        orgs = toJSON(data.filter(d => d._type === docTypes.organization));
        roleDefs = toJSON(data.filter(d => d._type === docTypes.roleDef));
    });

    it('check getUser works', async function () {
        const user = users.filter(u => u.firstname === 'Christian')[0];
        const userData = await queryMgr.getUser(user.uniqueId);
        assert.deepStrictEqual(userData, user);
    });

    it('check getRoleDefinition works', async function () {
        const roleDef = roleDefs.filter(r => r.name === 'role1')[0];
        const roleData = await queryMgr.getRoleDefinition(roleDef.orgId, roleDef.roleDefId);
        assert.deepStrictEqual(roleData, roleDef);
    });

    it('check getOrganization works', async function () {
        await assert.rejects(() => queryMgr.getOrganization('blablabla'), QueryError);
        const org = orgs.filter(o => o.name === 'Risto')[0];
        const orgData = await queryMgr.getOrganization(org.orgId);
        assert.deepStrictEqual(orgData, org);
    });

    it('check getOrganizationRoles works', async function () {
        await assert.rejects(() => queryMgr.getOrganizationRoles('blablabla'), QueryError);
        const org = orgs.filter(o => o.name === 'Risto')[0];
        const rolesExpected = roleDefs.filter(r => r.orgId === org.orgId);
        const rolesRetrieved = await queryMgr.getOrganizationRoles(org.orgId);
        assert.deepStrictEqual(rolesRetrieved, rolesExpected);
    });

    it('check getOrganizationUsers works', async function () {
        await assert.rejects(() => queryMgr.getOrganizationUsers('blablabla'), QueryError);
        const org = orgs.filter(o => o.name === 'Risto')[0];
        const usersExpected = users.filter(u => u.organizations.includes(org.orgId));
        usersExpected.forEach(u => {
            u.roles = { [org.orgId]: u.roles[org.orgId] };
        });
        const usersRetrieved = await queryMgr.getOrganizationUsers(org.orgId);
        assert.deepStrictEqual(usersRetrieved, usersExpected);
    });

    it('check getOrganizationUserRoles works', async function () {
        const user = users.filter(u => u.firstname === 'Christian')[0];
        const orgId = user.organizations[0];

        await assert.rejects(() => queryMgr.getOrganizationUserRoles('blablabla'), QueryError);
        await assert.rejects(() => queryMgr.getOrganizationUserRoles(orgId, 'blablabla'), QueryError);

        const userRoleDefsMap = {};
        roleDefs.filter(r => user.roles[orgId].map(ur => ur.roleDefId).includes(r.roleDefId)).forEach(r => {
            userRoleDefsMap[r.roleDefId] = RoleDefinition.fromObject(r);
        });
        const rolesExpected = user.roles[orgId].map(ri => new RoleInstance({ roleDef: userRoleDefsMap[ri.roleDefId], paramValues: ri.paramValues }));

        const rolesRetrieved = await queryMgr.getOrganizationUserRoles(orgId, user.uniqueId);
        assert.deepStrictEqual(rolesRetrieved, rolesExpected);
        rolesRetrieved.forEach(r => {
            assert.ok(r instanceof RoleInstance);
        });
    });

    it('check getFullOrganization works', async function () {
        await assert.rejects(() => queryMgr.getFullOrganization('blablabla'), QueryError);

        const org = toJSON(orgs.filter(o => o.name === 'Risto')[0]);
        org.users = users.filter(u => u.organizations.includes(org.orgId));
        org.roles = roleDefs.filter(r => r.orgId === org.orgId);
        const orgRetrieved = await queryMgr.getFullOrganization(org.orgId);
        assert.deepStrictEqual(orgRetrieved, org);
    });

    it('check getFullUser works', async function () {
        await assert.rejects(() => queryMgr.getFullUser('blablabla'), QueryError);

        const user = users.filter(u => u.firstname === 'Christian')[0];
        user.organizations = orgs.filter(o => user.organizations.includes(o.orgId));
        Object.keys(user.roles).forEach(k => {
            const rolesIds = user.roles[k].map(ur => ur.roleDefId);
            const rolesMap = {};
            roleDefs.filter(r => rolesIds.includes(r.roleDefId)).forEach(r => {
                rolesMap[r.roleDefId] = RoleDefinition.fromObject(r);
            });
            user.roles[k] = user.roles[k].map(ri => new RoleInstance({ roleDef: rolesMap[ri.roleDefId], paramValues: ri.paramValues }));
        });

        const userRetrieved = await queryMgr.getFullUser(user.uniqueId);
        assert.deepStrictEqual(userRetrieved, user);
        Object.keys(user.roles).forEach(k => {
            assert.ok(userRetrieved.roles[k][0] instanceof RoleInstance);
        });
    });

    it('check getUserOrganizations works', async function () {
        await assert.rejects(() => queryMgr.getUserOrganizations('blablabla'), QueryError);

        const user = users.filter(u => u.firstname === 'Christian')[0];
        const expectedOrgs = orgs.filter(o => user.organizations.includes(o.orgId));

        const orgsRetrieved = await queryMgr.getUserOrganizations(user.uniqueId);
        assert.deepStrictEqual(orgsRetrieved, expectedOrgs);
    });

    it('check getUserRoles works', async function () {
        await assert.rejects(() => queryMgr.getUserRoles('blablabla'), QueryError);
        
        const user = users.filter(u => u.firstname === 'Christian')[0];
        const rolesMapExpected = {}
        Object.keys(user.roles).forEach(k => {
            const rolesIds = user.roles[k].map(ur => ur.roleDefId);
            rolesMapExpected[k] = roleDefs.filter(r => rolesIds.includes(r.roleDefId));
        });

        const rolesMapRetrieved = await queryMgr.getUserRoles(user.uniqueId);
        assert.deepStrictEqual(rolesMapRetrieved, rolesMapExpected);
    });

    after(async () => {
        await collection.deleteMany({ _id: { $in: data.map(d => d._id) } });
        await client.close();
        await mongod.stop();
    });
});
