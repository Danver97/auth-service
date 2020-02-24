const assert = require('assert');
const DynamoDB = require('aws-sdk/clients/dynamodb');
const ENV = require('../../lib/env');
const orgEvents = require('../../lib/organization-events');
const repo = require('../../infrastructure/repository/repositoryManager')('dynamodb');
const Organization = require('../../domain/models/organization.class');
const Permission = require('../../domain/models/permission.class');
const Role = require('../../domain/models/role.class');
const OrganizationManager = require('../../domain/logic/organizationManager');
const OrganizationManagerError = require('../../domain/errors/organizationManager.error');

let orgMgr = new OrganizationManager(repo);

describe('Organization Manager unit test', function () {
    this.slow(3000);
    this.timeout(10000);
    let org;
    let orgId;
    const orgName = 'Risto';
    const perm = new Permission('auth-service', 'addRole');
    const perm2 = new Permission('auth-service', 'removeRole');
    const role = new Role('waiter', [perm]);
    const userId = 'userId1';

    async function checkRightEventIsWritten(eventMessage) {
        const events = await repo.db.getStream(orgId);
        const lastEvent = events[events.length-1];
        assert.strictEqual(lastEvent.message, eventMessage);
    }

    beforeEach(async () => {
        org = new Organization(orgName);
        if (typeof repo.db.reset === 'function')
            await repo.db.reset();
        else {
            const ddb = new DynamoDB({ apiVersion: '2012-08-10', endpoint: ENV.DDB_URL })
            await ddb.deleteItem({
                Key: {
                    StreamId: {
                        S: userId,
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
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;

        // Assertions
        await checkRightEventIsWritten(orgEvents.organizationCreated);
    });

    it('check roleAdded works', async function () {
        // Setup
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;

        // Update
        await orgMgr.roleAdded(orgId, role);

        // Assertions
        await checkRightEventIsWritten(orgEvents.roleAdded);
    });

    it('check roleChanged works', async function () {
        // Setup
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;
        await orgMgr.roleAdded(orgId, role);

        // Update
        role.changeName('name2');
        role.changePermissions([perm2]);
        await orgMgr.roleChanged(orgId, role.roleId, role);

        // Assertions
        await assert.rejects(() => orgMgr.roleChanged(orgId, role.roleId, {}), OrganizationManagerError);
        await checkRightEventIsWritten(orgEvents.roleChanged);
    });

    it('check roleRemoved works', async function () {
        // Setup
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;
        await orgMgr.roleAdded(orgId, role);

        // Update
        await orgMgr.roleRemoved(orgId, role.roleId);

        // Assertions
        await checkRightEventIsWritten(orgEvents.roleRemoved);
    });

    it('check userAdded works', async function () {
        // Setup
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;

        // Update
        await orgMgr.userAdded(orgId, userId);

        // Assertions
        await checkRightEventIsWritten(orgEvents.userAdded);
    });

    it('check rolesAssignedToUser works', async function () {
        // Setup
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;
        await orgMgr.roleAdded(orgId, role);
        await orgMgr.userAdded(orgId, userId);

        // Update
        await orgMgr.rolesAssignedToUser(orgId, userId, [role.roleId]);

        // Assertions
        await checkRightEventIsWritten(orgEvents.rolesAssignedToUser);
    });

    it('check rolesRemovedFromUser works', async function () {
        // Setup
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;
        await orgMgr.roleAdded(orgId, role);
        await orgMgr.userAdded(orgId, userId);
        await orgMgr.rolesAssignedToUser(orgId, userId, [role.roleId]);

        // Update
        await orgMgr.rolesRemovedFromUser(orgId, userId, [role.roleId]);

        // Assertions
        await checkRightEventIsWritten(orgEvents.rolesRemovedFromUser);
    });

    it('check userRemoved works', async function () {
        // Setup
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;
        await orgMgr.userAdded(orgId, userId);

        // Update
        await orgMgr.userRemoved(orgId, userId);

        // Assertions
        await checkRightEventIsWritten(orgEvents.userRemoved);
    });

    it('check organizationDeleted works', async function () {
        // Setup
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;

        // Update
        await orgMgr.organizationDeleted(orgId);

        // Assertions
        await checkRightEventIsWritten(orgEvents.organizationDeleted);
    });
});