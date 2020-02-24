const assert = require('assert');
const DynamoDB = require('aws-sdk/clients/dynamodb');
const ENV = require('../../lib/env');
const orgEvents = require('../../lib/organization-events');
const userEvents = require('../../lib/user-events');
const repo = require('../../infrastructure/repository/repositoryManager')('dynamodb');
const User = require('../../domain/models/user.class');
const Organization = require('../../domain/models/organization.class');
const Permission = require('../../domain/models/permission.class');
const Role = require('../../domain/models/role.class');
const RepositoryError = require('../../infrastructure/repository/repo.error');

function toJSON(obj) {
    return JSON.parse(JSON.stringify(obj));
}

describe('Repository Manager unit test', function () {
    this.timeout(5000);
    let org;
    const perm = new Permission('auth-service', 'addRole');
    const perm2 = new Permission('auth-service', 'removeRole');
    const role = new Role('waiter', [perm]);
    const userId = 'userId1';
    const userOptions = {
        accountId: 14546434341331,
        accountType: 'Google',
        firstname: 'Christian',
        lastname: 'Paesante',
        email: 'chri.pae@gmail.com',
    };
    const user = new User(userOptions);

    beforeEach(async () => {
        org = new Organization('Risto');
        if (typeof repo.db.reset === 'function')
            await repo.db.reset();
        else {
            const ddb = new DynamoDB({ apiVersion: '2012-08-10', endpoint: ENV.DDB_URL })
            await ddb.deleteItem({
                Key: {
                    StreamId: {
                        S: user.uniqueId,
                    },
                    EventId: {
                        N: '1'
                    }
                },
                TableName: `${ENV.MICROSERVICE_NAME}EventStreamTable`
            }).promise();
        }
    });

    it('check organizationCreated works', async function () {
        // Update
        await repo.organizationCreated(org);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length - 1];
        assert.strictEqual(lastEvent.message, orgEvents.organizationCreated);
        assert.deepStrictEqual(lastEvent.payload, org.toJSON());
    });

    it('check roleAdded works', async function () {
        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;

        // Update
        org.addRole(role);
        await repo.roleAdded(org, role);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length - 1];
        assert.strictEqual(lastEvent.message, orgEvents.roleAdded);
        assert.deepStrictEqual(lastEvent.payload, toJSON({ orgId: org.orgId, role }));
    });

    it('check roleChanged works', async function () {
        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;
        org.addRole(role);
        await repo.roleAdded(org, role);
        org._revisionId++;

        // Update
        role.changeName('name2');
        role.changePermissions([perm2]);
        await repo.roleChanged(org, role);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length - 1];
        assert.strictEqual(lastEvent.message, orgEvents.roleChanged);
        assert.deepStrictEqual(lastEvent.payload, toJSON({ orgId: org.orgId, role }));
    });

    it('check roleRemoved works', async function () {
        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;
        org.addRole(role);
        await repo.roleAdded(org, role);
        org._revisionId++;

        // Update
        org.removeRole(role.roleId);
        await repo.roleRemoved(org, role.roleId);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length - 1];
        assert.strictEqual(lastEvent.message, orgEvents.roleRemoved);
        assert.deepStrictEqual(lastEvent.payload, toJSON({ orgId: org.orgId, roleId: role.roleId }));
    });

    it('check userAdded works', async function () {
        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;

        // Update
        org.addUser(userId);
        await repo.userAdded(org, userId);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length - 1];
        assert.strictEqual(lastEvent.message, orgEvents.userAdded);
        assert.deepStrictEqual(lastEvent.payload, toJSON({ orgId: org.orgId, userId }));
    });

    it('check rolesAssignedToUser works', async function () {
        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;
        org.addRole(role);
        await repo.roleAdded(org, role);
        org._revisionId++;
        org.addUser(userId);
        await repo.userAdded(org, userId);
        org._revisionId++;
        const roles = [role.roleId]

        // Update
        org.assignRolesToUser(userId, roles);
        await repo.rolesAssignedToUser(org, userId, roles);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length - 1];
        assert.strictEqual(lastEvent.message, orgEvents.rolesAssignedToUser);
        assert.deepStrictEqual(lastEvent.payload, toJSON({ orgId: org.orgId, userId, roles }));
    });

    it('check rolesRemovedFromUser works', async function () {
        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;
        org.addRole(role);
        await repo.roleAdded(org, role);
        org._revisionId++;
        org.addUser(userId);
        await repo.userAdded(org, userId);
        org._revisionId++;
        const roles = [role.roleId]
        org.assignRolesToUser(userId, roles);
        await repo.rolesAssignedToUser(org, userId, roles);
        org._revisionId++;

        // Update
        org.removeRolesFromUser(userId, roles);
        await repo.rolesRemovedFromUser(org, userId, roles);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length - 1];
        assert.strictEqual(lastEvent.message, orgEvents.rolesRemovedFromUser);
        assert.deepStrictEqual(lastEvent.payload, toJSON({ orgId: org.orgId, userId, roles }));
    });

    it('check userRemoved works', async function () {
        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;
        org.addUser(userId);
        await repo.userAdded(org, userId);
        org._revisionId++;

        // Update
        org.removeUser(userId);
        await repo.userRemoved(org, userId);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length - 1];
        assert.strictEqual(lastEvent.message, orgEvents.userRemoved);
        assert.deepStrictEqual(lastEvent.payload, toJSON({ orgId: org.orgId, userId }));
    });

    it('check organizationDeleted works', async function () {
        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;

        // Update
        org.delete();
        await repo.organizationDeleted(org);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length - 1];
        assert.strictEqual(lastEvent.message, orgEvents.organizationDeleted);
        assert.deepStrictEqual(lastEvent.payload, { orgId: org.orgId, status: org.status });
    });

    it('check getOrganization works', async function () {
        await assert.rejects(() => repo.getOrganization('blablabla'), RepositoryError);

        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;
        org.addRole(role);
        await repo.roleAdded(org, role);
        org._revisionId++;
        role.changeName('name2');
        role.changePermissions([perm2]);
        await repo.roleChanged(org, role);
        org._revisionId++;
        org.addUser(userId);
        await repo.userAdded(org, userId);
        org._revisionId++;
        const roles = [role.roleId]
        org.assignRolesToUser(userId, roles);
        await repo.rolesAssignedToUser(org, userId, roles);
        org._revisionId++;
        org.removeRolesFromUser(userId, roles);
        await repo.rolesRemovedFromUser(org, userId, roles);
        org._revisionId++;
        org.removeUser(userId);
        await repo.userRemoved(org, userId);
        org._revisionId++;
        org.delete();
        await repo.organizationDeleted(org);
        org._revisionId++;

        const org2 = await repo.getOrganization(org.orgId);
        assert.deepStrictEqual(org2, org);
    });

    it('check userCreated works', async function () {
        // Update
        await repo.userCreated(user);

        // Assertions
        const events = await repo.db.getStream(user.uniqueId);
        const lastEvent = events[events.length - 1];
        assert.strictEqual(lastEvent.message, userEvents.userCreated);
        assert.deepStrictEqual(lastEvent.payload, toJSON(user));
    });

    it('check getUser works', async function () {
        await assert.rejects(() => repo.getUser('blablabla'), RepositoryError);

        // Setup
        await repo.userCreated(user);

        // Assertions
        const userSaved = await repo.getUser(user.uniqueId);
        user._revisionId = 1;
        assert.deepStrictEqual(userSaved, user);
    });
});
