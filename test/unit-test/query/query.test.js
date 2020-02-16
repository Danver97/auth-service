const assert = require('assert');
const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const MongoClient = require('mongodb').MongoClient;
const queryMgrFunc = require('../../../infrastructure/query');
const data = require('./collection.json');

// console.log(data);
const mongod = new MongoMemoryServer();
let client = null;
let collection = null;
let queryMgr = null;

function toJSON(obj) {
    return JSON.parse(JSON.stringify(obj));
}

describe('Query Manager unit test', function () {
    const users = data.filter(d => d.type === 'user');
    const orgs = data.filter(d => d.type === 'organization');
    const roles = data.filter(d => d.type === 'role');

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

    it('check getOrganizationUsers works', async function () {
        const org = orgs.filter(o => o.name === 'Risto')[0];
        const usersExpected = users.filter(u => u.organizations.includes(org.orgId));
        const usersRetrieved = await queryMgr.getOrganizationUsers(org.orgId);
        assert.deepStrictEqual(usersRetrieved, usersExpected);
    });

    it('check getOrganizationRoles works', async function () {
        const org = orgs.filter(o => o.name === 'Risto')[0];
        const rolesExpected = roles.filter(r => r.orgId === org.orgId);
        const rolesRetrieved = await queryMgr.getOrganizationRoles(org.orgId);
        assert.deepStrictEqual(rolesRetrieved, rolesExpected);
    });

    it('check getFullOrganization2 works', async function () {
        const org = toJSON(orgs.filter(o => o.name === 'Risto')[0]);
        org.users = users.filter(u => u.organizations.includes(org.orgId));
        org.roles = roles.filter(r => r.orgId === org.orgId);
        const orgRetrieved = await queryMgr.getFullOrganization2(org.orgId);
        assert.deepStrictEqual(orgRetrieved, org);
    });

    it('check getFullUser2 works', async function () {
        const user = users.filter(u => u.firstname === 'Christian')[0];
        user.organizations = orgs.filter(o => user.organizations.includes(o.orgId));
        Object.keys(user.roles).forEach(k => {
            const rolesIds = user.roles[k];
            user.roles[k] = roles.filter(r => rolesIds.includes(r.roleId));
        });

        const userRetrieved = await queryMgr.getFullUser2(user.uniqueId);
        assert.deepStrictEqual(userRetrieved, user);
    });

    after(async () => {
        await client.close();
        await mongod.stop();
    });
});
