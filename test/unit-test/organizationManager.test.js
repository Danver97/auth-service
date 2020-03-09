const assert = require('assert');
const orgEvents = require('../../lib/organization-events');
const repo = require('../../infrastructure/repository/repositoryManager')('testdb');
const Organization = require('../../domain/models/organization.class');
const RoleInstance = require('../../domain/models/roleInstance.class');
const RoleDefinition = require('../../domain/models/roleDef.class');
const PermissionDefinition = require('../../domain/models/permissionDef.class');
const OrganizationManager = require('../../domain/logic/organizationManager');
const OrganizationManagerError = require('../../domain/errors/organizationManager.error');

let orgMgr = new OrganizationManager(repo);

describe('Organization Manager unit test', function () {
    let org;
    let roleInstance;
    let orgId;
    const orgName = 'Risto';
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
    const roleDef = new RoleDefinition({
        roleDefId: 'Waiter',
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
    });
    const userId = 'userId1';

    async function checkRightEventIsWritten(eventMessage) {
        const events = await repo.db.getStream(orgId);
        const lastEvent = events[events.length-1];
        assert.strictEqual(lastEvent.message, eventMessage);
    }

    beforeEach(async () => {
        org = new Organization(orgName);
        roleInstance = new RoleInstance({ roleDef, paramValues: { orgId: org.orgId } });
        await repo.db.reset();
    });

    it('check organizationCreated works', async function () {
        // Update
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;

        // Assertions
        await checkRightEventIsWritten(orgEvents.organizationCreated);
    });

    it('check roleDefinitionAdded works', async function () {
        // Setup
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;

        // Update
        await orgMgr.roleDefinitionAdded(orgId, roleDef);

        // Assertions
        await checkRightEventIsWritten(orgEvents.roleDefinitionAdded);
    });

    it('check roleDefinitionChanged works', async function () {
        // Setup
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;
        await orgMgr.roleDefinitionAdded(orgId, roleDef);

        // Update
        roleDef.changeName('name2');
        roleDef.changeParamsMapping({
            'orgId': {
                name: 'OrganizationId',
                description: 'The id of the organization the user belongs to',
                mapping: [`${permDef1.scope}:${permDef1.name}:orgId`, `${permDef2.scope}:${permDef2.name}:orgId`],
            }
        });
        roleDef.changePermissions([permDef2]);
        await orgMgr.roleDefinitionChanged(orgId, roleDef.roleDefId, roleDef);

        // Assertions
        await assert.rejects(() => orgMgr.roleDefinitionChanged(orgId, roleDef.roleDefId, {}), OrganizationManagerError);
        await checkRightEventIsWritten(orgEvents.roleDefinitionChanged);
    });

    it('check roleDefinitionRemoved works', async function () {
        // Setup
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;
        await orgMgr.roleDefinitionAdded(orgId, roleDef);

        // Update
        await orgMgr.roleDefinitionRemoved(orgId, roleDef.roleDefId);

        // Assertions
        await checkRightEventIsWritten(orgEvents.roleDefinitionRemoved);
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
        await orgMgr.roleDefinitionAdded(orgId, roleDef);
        await orgMgr.userAdded(orgId, userId);

        // Update
        await orgMgr.rolesAssignedToUser(orgId, userId, [roleInstance]);

        // Assertions
        await checkRightEventIsWritten(orgEvents.rolesAssignedToUser);
    });

    it('check rolesRemovedFromUser works', async function () {
        // Setup
        orgId = (await orgMgr.organizationCreated(orgName)).orgId;
        await orgMgr.roleDefinitionAdded(orgId, roleDef);
        await orgMgr.userAdded(orgId, userId);
        await orgMgr.rolesAssignedToUser(orgId, userId, [roleInstance]);

        // Update
        await orgMgr.rolesRemovedFromUser(orgId, userId, [roleInstance.id]);

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