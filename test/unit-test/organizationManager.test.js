const assert = require('assert');
const orgEvents = require('../../lib/organization-events');
const repo = require('../../infrastructure/repository/repositoryManager')('testdb');
const Organization = require('../../domain/models/organization.class');
const Permission = require('../../domain/models/permission.class');
const Role = require('../../domain/models/role.class');
const OrganizationManager = require('../../domain/logic/organizationManager');

let orgMgr = new OrganizationManager(repo);

describe('Organization Manager unit test', function () {
    let org;
    let orgId;
    const orgName = 'Risto';
    const perm = new Permission('auth-service', 'addRole');
    const role = new Role('waiter', [perm]);
    const userId = 'userId1';

    async function checkRightEventIsWritten(eventMessage) {
        const events = await repo.db.getStream(orgId);
        const lastEvent = events[events.length-1];
        assert.strictEqual(lastEvent.message, eventMessage);
    }

    beforeEach(async () => {
        org = new Organization(orgName);
        await repo.db.reset();
    });

    it('check organizationCreated works', async function () {
        // Update
        orgId = await orgMgr.organizationCreated(orgName);

        // Assertions
        await checkRightEventIsWritten(orgEvents.organizationCreated);
    });

    it('check roleAdded works', async function () {
        // Setup
        orgId = await orgMgr.organizationCreated(orgName);

        // Update
        await orgMgr.roleAdded(orgId, role);

        // Assertions
        await checkRightEventIsWritten(orgEvents.roleAdded);
    });

    it('check roleRemoved works', async function () {
        // Setup
        orgId = await orgMgr.organizationCreated(orgName);
        await orgMgr.roleAdded(orgId, role);

        // Update
        await orgMgr.roleRemoved(orgId, role.roleId);

        // Assertions
        await checkRightEventIsWritten(orgEvents.roleRemoved);
    });

    it('check userAdded works', async function () {
        // Setup
        orgId = await orgMgr.organizationCreated(orgName);

        // Update
        await orgMgr.userAdded(orgId, userId);

        // Assertions
        await checkRightEventIsWritten(orgEvents.userAdded);
    });

    it('check rolesAssignedToUser works', async function () {
        // Setup
        orgId = await orgMgr.organizationCreated(orgName);
        await orgMgr.roleAdded(orgId, role);
        await orgMgr.userAdded(orgId, userId);

        // Update
        await orgMgr.rolesAssignedToUser(orgId, userId, [role.roleId]);

        // Assertions
        await checkRightEventIsWritten(orgEvents.rolesAssignedToUser);
    });

    it('check rolesRemovedFromUser works', async function () {
        // Setup
        orgId = await orgMgr.organizationCreated(orgName);
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
        orgId = await orgMgr.organizationCreated(orgName);
        await orgMgr.userAdded(orgId, userId);

        // Update
        await orgMgr.userRemoved(orgId, userId);

        // Assertions
        await checkRightEventIsWritten(orgEvents.userRemoved);
    });

    it('check organizationDeleted works', async function () {
        // Setup
        orgId = await orgMgr.organizationCreated(orgName);

        // Update
        await orgMgr.organizationDeleted(orgId);

        // Assertions
        await checkRightEventIsWritten(orgEvents.organizationDeleted);
    });
});