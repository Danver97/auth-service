const assert = require('assert');
const orgEvents = require('../../lib/organization-events');
const userEvents = require('../../lib/user-events');
const repo = require('../../infrastructure/repository/repositoryManager')('testdb');
const User = require('../../domain/models/user.class');
const Organization = require('../../domain/models/organization.class');
const PermissionDefinition = require('../../domain/models/permissionDef.class');
const RoleDefinition = require('../../domain/models/roleDef.class');
const RoleInstance = require('../../domain/models/roleInstance.class');
const RepositoryError = require('../../infrastructure/repository/repo.error');

function toJSON(obj) {
    return JSON.parse(JSON.stringify(obj));
}

describe('Repository Manager unit test', function () {
    let org;
    let roleInstance;
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
        roleInstance = new RoleInstance({ roleDef, paramValues: { orgId: org.orgId } });
        await repo.db.reset();
    });

    it('check organizationCreated works', async function () {
        // Update
        await repo.organizationCreated(org);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length-1];
        assert.strictEqual(lastEvent.message, orgEvents.organizationCreated);
        assert.deepStrictEqual(lastEvent.payload, org.toJSON());
    });

    it('check roleDefinitionAdded works', async function () {
        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;

        // Update
        org.addRoleDefinition(roleDef);
        await repo.roleDefinitionAdded(org, roleDef);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length-1];
        assert.strictEqual(lastEvent.message, orgEvents.roleDefinitionAdded);
        assert.deepStrictEqual(lastEvent.payload, toJSON({ orgId: org.orgId, roleDef }));
    });

    it('check roleDefinitionChanged works', async function () {
        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;
        org.addRoleDefinition(roleDef);
        await repo.roleDefinitionAdded(org, roleDef);
        org._revisionId++;

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
        await repo.roleDefinitionChanged(org, roleDef);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length-1];
        assert.strictEqual(lastEvent.message, orgEvents.roleDefinitionChanged);
        assert.deepStrictEqual(lastEvent.payload, toJSON({ orgId: org.orgId, roleDef }));
    });

    it('check roleDefinitionRemoved works', async function () {
        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;
        org.addRoleDefinition(roleDef);
        await repo.roleDefinitionAdded(org, roleDef);
        org._revisionId++;

        // Update
        org.removeRoleDefinition(roleDef.roleDefId);
        await repo.roleDefinitionRemoved(org, roleDef.roleDefId);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length-1];
        assert.strictEqual(lastEvent.message, orgEvents.roleDefinitionRemoved);
        assert.deepStrictEqual(lastEvent.payload, toJSON({ orgId: org.orgId, roleId: roleDef.roleDefId }));
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
        const lastEvent = events[events.length-1];
        assert.strictEqual(lastEvent.message, orgEvents.userAdded);
        assert.deepStrictEqual(lastEvent.payload, toJSON({ orgId: org.orgId, userId }));
    });

    it('check rolesAssignedToUser works', async function () {
        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;
        org.addRoleDefinition(roleDef);
        await repo.roleDefinitionAdded(org, roleDef);
        org._revisionId++;
        org.addUser(userId);
        await repo.userAdded(org, userId);
        org._revisionId++;
        const roles = [roleInstance]

        // Update
        org.assignRolesToUser(userId, roles);
        await repo.rolesAssignedToUser(org, userId, roles);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length-1];
        assert.strictEqual(lastEvent.message, orgEvents.rolesAssignedToUser);
        assert.deepStrictEqual(lastEvent.payload, toJSON({ orgId: org.orgId, userId, roles }));
    });

    it('check rolesRemovedFromUser works', async function () {
        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;
        org.addRoleDefinition(roleDef);
        await repo.roleDefinitionAdded(org, roleDef);
        org._revisionId++;
        org.addUser(userId);
        await repo.userAdded(org, userId);
        org._revisionId++;
        const roles = [roleInstance];
        org.assignRolesToUser(userId, roles);
        await repo.rolesAssignedToUser(org, userId, roles);
        org._revisionId++;

        // Update
        const roleIds = [roleInstance.id];
        org.removeRolesFromUser(userId, roleIds);
        await repo.rolesRemovedFromUser(org, userId, roleIds);

        // Assertions
        const events = await repo.db.getStream(org.orgId);
        const lastEvent = events[events.length-1];
        assert.strictEqual(lastEvent.message, orgEvents.rolesRemovedFromUser);
        assert.deepStrictEqual(lastEvent.payload, toJSON({ orgId: org.orgId, userId, roles: roleIds }));
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
        const lastEvent = events[events.length-1];
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
        const lastEvent = events[events.length-1];
        assert.strictEqual(lastEvent.message, orgEvents.organizationDeleted);
        assert.deepStrictEqual(lastEvent.payload, { orgId: org.orgId, status: org.status });
    });

    it('check getOrganization works', async function () {
        await assert.rejects(() => repo.getOrganization('blablabla'), RepositoryError);

        // Setup
        await repo.organizationCreated(org);
        org._revisionId = 1;
        org.addRoleDefinition(roleDef);
        await repo.roleDefinitionAdded(org, roleDef);
        org._revisionId++;
        roleDef.changeName('name2');
        roleDef.changePermissions([permDef2]);
        await repo.roleDefinitionChanged(org, roleDef);
        org._revisionId++;
        org.addUser(userId);
        await repo.userAdded(org, userId);
        org._revisionId++;
        const roles = [roleInstance];
        org.assignRolesToUser(userId, roles);
        await repo.rolesAssignedToUser(org, userId, roles);
        org._revisionId++;
        const roleIds = [roleInstance.id];
        org.removeRolesFromUser(userId, roleIds);
        await repo.rolesRemovedFromUser(org, userId, roleIds);
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
        const lastEvent = events[events.length-1];
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
