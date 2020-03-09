const assert = require('assert');
const PermissionDefinition = require('../../domain/models/permissionDef.class');
const RoleInstance = require('../../domain/models/roleInstance.class');
const RoleDefinition = require('../../domain/models/roleDef.class');
const Organization = require('../../domain/models/organization.class');
const OrganizationError = require('../../domain/errors/organization.error');

describe('Organization class unit test', function () {
    const name = 'Risto';
    const permDef1 = new PermissionDefinition({
        scope: 'reservation-service', name: 'acceptReservation', parameters: {
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
                mapping: `${permDef1.scope}:${permDef1.name}:orgId`,
            },
            'restId': {
                mapping: `${permDef1.scope}:${permDef1.name}:restId`,
            },
        }
    });
    const userId = 'user1';
    const orgId =  'id1';

    it('check constructor works', function () {
        assert.throws(() => new Organization(), OrganizationError);
        assert.throws(() => new Organization(''), OrganizationError);
        assert.throws(() => new Organization({}), OrganizationError);

        const org = new Organization(name);
        assert.strictEqual(org.name, name);
        assert.ok(typeof org.orgId === 'string');
    });

    it('check delete works', function () {
        const org = new Organization(name);
        org.delete();
        assert.strictEqual(org.status, 'deleted');
        assert.ok(org.isDeleted());
        assert.throws(() => org.delete(), OrganizationError);
    });

    it('check addRole works', function () {
        let org = new Organization(name);
        assert.throws(() => org.addRoleDefinition(), OrganizationError);
        assert.throws(() => org.addRoleDefinition('aa'), OrganizationError);
        assert.throws(() => org.addRoleDefinition({}), OrganizationError);
        org.delete();
        assert.throws(() => org.addRoleDefinition(roleDef), OrganizationError);

        org = new Organization(name);
        org.addRoleDefinition(roleDef);
        assert.deepStrictEqual(org.roles, [roleDef]);
    });

    it('check getRole works', function () {
        let org = new Organization(name);
        assert.throws(() => org.getRoleDefinition(), OrganizationError);
        assert.throws(() => org.getRoleDefinition('aa'), OrganizationError);
        assert.throws(() => org.getRoleDefinition({}), OrganizationError);
        org.delete();
        assert.throws(() => org.getRoleDefinition(roleDef.roleDefId), OrganizationError);

        org = new Organization(name);
        org.addRoleDefinition(roleDef);
        const roleRetrieved = org.getRoleDefinition(roleDef.roleDefId);
        assert.deepStrictEqual(roleRetrieved, roleDef);
    });

    it('check removeRole works', function () {
        let org = new Organization(name);
        assert.throws(() => org.removeRoleDefinition(), OrganizationError);
        assert.throws(() => org.removeRoleDefinition('aa'), OrganizationError);
        assert.throws(() => org.removeRoleDefinition({}), OrganizationError);
        org.delete();
        assert.throws(() => org.removeRoleDefinition(roleDef.roleDefId), OrganizationError);

        org = new Organization(name);
        org.addRoleDefinition(roleDef);
        org.removeRoleDefinition(roleDef.roleDefId);
        assert.deepStrictEqual(org.roles, []);
        assert.deepStrictEqual(org.roles, []);
    });

    it('check addUser works', function () {
        let org = new Organization(name);
        let roleInstance = new RoleInstance({ roleDef, paramValues: { orgId: org.orgId } });
        assert.throws(() => org.addUser(), OrganizationError);
        assert.throws(() => org.addUser({}), OrganizationError);
        org.delete();
        assert.throws(() => org.addUser(userId), OrganizationError);

        org = new Organization(name);
        org.addUser(userId);
        let expected = {
            userId,
            roles: [],
        };
        assert.deepStrictEqual(org.users, [expected]);
        assert.throws(() => org.addUser(userId), OrganizationError);

        org = new Organization(name);
        org.addRoleDefinition(roleDef);
        org.addUser(userId, [roleInstance]);
        expected = {
            userId,
            roles: [roleInstance],
        };
        assert.deepStrictEqual(org.users, [expected]);
    });

    it('check assignRolesToUser works', function () {
        let org = new Organization(name);
        let roleInstance = new RoleInstance({ roleDef, paramValues: { orgId: org.orgId } });
        org.addRoleDefinition(roleDef);
        org.addUser(userId);
        assert.throws(() => org.assignRolesToUser(), OrganizationError);
        assert.throws(() => org.assignRolesToUser('aa'), OrganizationError);
        assert.throws(() => org.assignRolesToUser({}), OrganizationError);
        assert.throws(() => org.assignRolesToUser(userId), OrganizationError);
        assert.throws(() => org.assignRolesToUser(userId, {}), OrganizationError);
        assert.throws(() => org.assignRolesToUser(userId, roleDef), OrganizationError);
        assert.throws(() => org.assignRolesToUser(userId, [roleDef]), OrganizationError);
        org.delete();
        assert.throws(() => org.assignRolesToUser(userId, [roleInstance]), OrganizationError);

        org = new Organization(name);
        roleInstance = new RoleInstance({ roleDef, paramValues: { orgId: org.orgId } });
        org.addRoleDefinition(roleDef);
        org.addUser(userId);
        org.assignRolesToUser(userId, [roleInstance]);
        const expected = {
            userId,
            roles: [roleInstance],
        };
        assert.deepStrictEqual(org.users, [expected]);
    });

    it('check removeRolesFromUser works', function () {
        let org = new Organization(name);
        let roleInstance = new RoleInstance({ roleDef, paramValues: { orgId: org.orgId } });
        org.addRoleDefinition(roleDef);
        org.addUser(userId);
        assert.throws(() => org.removeRolesFromUser(), OrganizationError);
        assert.throws(() => org.removeRolesFromUser('aa'), OrganizationError);
        assert.throws(() => org.removeRolesFromUser({}), OrganizationError);
        assert.throws(() => org.removeRolesFromUser(userId), OrganizationError);
        assert.throws(() => org.removeRolesFromUser(userId, roleDef), OrganizationError);
        assert.throws(() => org.removeRolesFromUser(userId, [roleDef]), OrganizationError);
        org.delete();
        assert.throws(() => org.removeRolesFromUser(userId, [roleInstance]), OrganizationError);

        org = new Organization(name);
        roleInstance = new RoleInstance({ roleDef, paramValues: { orgId: org.orgId } });
        org.addRoleDefinition(roleDef);
        org.addUser(userId);
        org.assignRolesToUser(userId, [roleInstance]);
        org.removeRolesFromUser(userId, [roleInstance.id]);
        const expected = {
            userId,
            roles: [],
        };
        assert.deepStrictEqual(org.users, [expected]);
    });

    it('check removeUser works', function () {
        let org = new Organization(name);
        assert.throws(() => org.removeUser(), OrganizationError);
        assert.throws(() => org.removeUser('aa'), OrganizationError);
        assert.throws(() => org.removeUser({}), OrganizationError);
        org.delete();
        assert.throws(() => org.removeUser(userId), OrganizationError);

        org = new Organization(name);
        org.addUser(userId);
        org.removeUser(userId);
        assert.deepStrictEqual(org.users, []);
    });

    it('check fromObject works', function () {
        assert.throws(() => Organization.fromObject(), OrganizationError);
        let roleInstance = new RoleInstance({ roleDef, paramValues: { orgId: 'org1' } });

        const obj1 = {
            orgId,
            name,
        }
        const org1 = Organization.fromObject(obj1);
        assert.strictEqual(org1.orgId, orgId);
        assert.strictEqual(org1.name, name);
        assert.deepStrictEqual(org1.roles, []);
        assert.deepStrictEqual(org1.users, []);

        const obj2 = {
            orgId,
            name,
            roles: [JSON.parse(JSON.stringify(roleDef))],
            users: [{
                userId,
                roles: [JSON.parse(JSON.stringify(roleInstance))]
            }],
        }
        const org2 = Organization.fromObject(obj2);
        assert.strictEqual(org2.orgId, orgId);
        assert.strictEqual(org2.name, name);
        assert.deepStrictEqual(org2.roles, [roleDef]);
        const userExpected = {
            userId,
            roles: [roleInstance],
        };
        assert.deepStrictEqual(org2.users, [userExpected]);
    });

    it('check toJSON works', function () {
        let org = new Organization(name);
        let json = org.toJSON();
        let expected = {
            name
        };
        assert.strictEqual(typeof json.orgId, 'string')
        assert.notStrictEqual(json.orgId.length, 0);
        delete json.orgId;
        assert.deepStrictEqual(json, expected);

        org = new Organization(name);
        let roleInstance = new RoleInstance({ roleDef, paramValues: { orgId: 'org1' } });
        org.addRoleDefinition(roleDef);
        org.addUser(userId, [roleInstance]);

        expected = {
            name,
            roles: [roleDef],
            users: [{
                userId,
                roles: [roleInstance]
            }],
        };
        json = org.toJSON();
        assert.strictEqual(typeof json.orgId, 'string')
        assert.notStrictEqual(json.orgId.length, 0);
        expected.orgId = json.orgId;
        assert.deepStrictEqual(json, expected);
    });
});
