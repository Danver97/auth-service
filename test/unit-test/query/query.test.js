const assert = require('assert');
const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const MongoClient = require('mongodb').MongoClient;
const queryMgrFunc = require('../../../infrastructure/query');
const data = require('./collection.json');

const mongod = new MongoMemoryServer();
let client = null;
let collection = null;
let queryMgr = null;

function toJSON(obj) {
    return JSON.parse(JSON.stringify(obj));
}

describe('Query Manager unit test', function () {
    let users;
    let orgs;
    let roles;

    before(async function () {
        this.timeout(10000);
        const mongoConfig = {
            connString: await mongod.getConnectionString(),
            dbName: 'auth',
            collectionName: 'auth',
        };
        client = new MongoClient(mongoConfig.connString, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        collection = client.db(mongoConfig.dbName).collection(mongoConfig.collectionName);
        queryMgr = await queryMgrFunc(mongoConfig);
        await collection.insertMany(data)
    });

    beforeEach(() => {
        users = toJSON(data.filter(d => d._type === 'user'));
        orgs = toJSON(data.filter(d => d._type === 'organization'));
        roles = toJSON(data.filter(d => d._type === 'role'));
    })

    it('check getUser works', async function () {
        const user = users.filter(u => u.firstname === 'Christian')[0];
        const userData = await queryMgr.getUser(user.uniqueId);
        assert.deepStrictEqual(userData, user);
    });

    it('check getRole works', async function () {
        const role = roles.filter(r => r.name === 'role1')[0];
        const roleData = await queryMgr.getRole(role.roleId);
        assert.deepStrictEqual(roleData, role);
    });

    it('check getOrganization works', async function () {
        const org = orgs.filter(o => o.name === 'Risto')[0];
        const orgData = await queryMgr.getOrganization(org.orgId);
        assert.deepStrictEqual(orgData, org);
    });

    it('check getOrganizationRoles works', async function () {
        const org = orgs.filter(o => o.name === 'Risto')[0];
        const rolesExpected = roles.filter(r => r.orgId === org.orgId);
        const rolesRetrieved = await queryMgr.getOrganizationRoles(org.orgId);
        assert.deepStrictEqual(rolesRetrieved, rolesExpected);
    });

    it('check getOrganizationUsers works', async function () {
        const org = orgs.filter(o => o.name === 'Risto')[0];
        const usersExpected = users.filter(u => u.organizations.includes(org.orgId));
        const usersRetrieved = await queryMgr.getOrganizationUsers(org.orgId);
        assert.deepStrictEqual(usersRetrieved, usersExpected);
    });

    it('check getOrganizationUserRoles works', async function () {
        const user = users.filter(u => u.firstname === 'Christian')[0];
        const orgId = user.organizations[0];
        const rolesExpected = roles.filter(r => user.roles[orgId].includes(r.roleId));
        const rolesRetrieved = await queryMgr.getOrganizationUserRoles(orgId, user.uniqueId);
        assert.deepStrictEqual(rolesRetrieved, rolesExpected);
    });

    it('check getFullOrganization works', async function () {
        const org = toJSON(orgs.filter(o => o.name === 'Risto')[0]);
        org.users = users.filter(u => u.organizations.includes(org.orgId));
        org.roles = roles.filter(r => r.orgId === org.orgId);
        const orgRetrieved = await queryMgr.getFullOrganization(org.orgId);
        assert.deepStrictEqual(orgRetrieved, org);
    });

    it('check getFullUser works', async function () {
        const user = users.filter(u => u.firstname === 'Christian')[0];
        user.organizations = orgs.filter(o => user.organizations.includes(o.orgId));
        Object.keys(user.roles).forEach(k => {
            const rolesIds = user.roles[k];
            user.roles[k] = roles.filter(r => rolesIds.includes(r.roleId));
        });

        const userRetrieved = await queryMgr.getFullUser(user.uniqueId);
        assert.deepStrictEqual(userRetrieved, user);
    });

    it('check getUserOrganizations works', async function () {
        const user = users.filter(u => u.firstname === 'Christian')[0];
        const expectedOrgs = orgs.filter(o => user.organizations.includes(o.orgId));

        const orgsRetrieved = await queryMgr.getUserOrganizations(user.uniqueId);
        assert.deepStrictEqual(orgsRetrieved, expectedOrgs);
    });

    it('check getUserRoles works', async function () {
        const user = users.filter(u => u.firstname === 'Christian')[0];
        const rolesMapExpected = {}
        Object.keys(user.roles).forEach(k => {
            const rolesIds = user.roles[k];
            rolesMapExpected[k] = roles.filter(r => rolesIds.includes(r.roleId));
        });

        const rolesMapRetrieved = await queryMgr.getUserRoles(user.uniqueId);
        assert.deepStrictEqual(rolesMapRetrieved, rolesMapExpected);
    });

    after(async () => {
        await client.close();
        await mongod.stop();
    });
});
