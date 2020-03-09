const assert = require('assert');
const Role = require('../../domain/models/role.class');
const PermissionDefinition = require('../../domain/models/permissionDef.class');
const RoleDefinition = require('../../domain/models/roleDef.class');
const RoleDefinitionError = require('../../domain/errors/roleDef.error');

describe('Role class unit test', function () {
    const permDef1 = new PermissionDefinition({
        scope: 'reservation-service', name: 'acceptReservation', parameters: {
            orgId: { name: 'OrganizationId', description: 'The id of the organization the user belongs to', required: true },
            restId: { name: 'RestaurantId', description: 'The id of the restaurant', required: false },
        }
    });
    const permDef2 = new PermissionDefinition({
        scope: 'reservation-service', name: 'listReservation', parameters: {
            orgId: { name: 'OrganizationId', description: 'The id of the organization the user belongs to', required: true },
            restId: { name: 'RestaurantId', description: 'The id of the restaurant', required: true },
        }
    });
    const optionsDefaultRole = {
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
    };
    const optionsRole = {
        orgId: 'org1',
        name: 'Waiter',
        permissions: [permDef1],
        paramMapping: {
            'orgId': {
                name: 'OrganizationId',
                description: 'The id of the organization the user belongs to',
                mapping: `${permDef1.scope}:${permDef1.name}:orgId`,
            },
        }
    };

    it('check constructor works', function () {
        assert.throws(() => new RoleDefinition(), RoleDefinitionError);
        assert.throws(() => new RoleDefinition({}), RoleDefinitionError);
        assert.throws(() => new RoleDefinition({ orgId: 'a' }), RoleDefinitionError);
        assert.throws(() => new RoleDefinition({ orgId: 'a', name: 'b' }), RoleDefinitionError);
        assert.throws(() => new RoleDefinition({ orgId: 'a', name: 'b', paramMapping: {}, permissions: ['perm1'] }), RoleDefinitionError);
        assert.throws(() => new RoleDefinition({ orgId: 'a', name: 'b', paramMapping: {}, permissions: [{}] }), RoleDefinitionError);

        let roleDef = new RoleDefinition(optionsDefaultRole);
        assert.strictEqual(roleDef.roleDefId, optionsDefaultRole.roleDefId);
        assert.strictEqual(roleDef.orgId, 'default');
        assert.strictEqual(roleDef.name, optionsDefaultRole.name);
        assert.strictEqual(roleDef.description, optionsDefaultRole.description);
        assert.deepStrictEqual(roleDef.permissions, optionsDefaultRole.permissions);
        assert.deepStrictEqual(roleDef.paramMapping, optionsDefaultRole.paramMapping);

        roleDef = new RoleDefinition(optionsRole);
        assert.ok(typeof roleDef.roleDefId === 'string');
        assert.strictEqual(roleDef.orgId, optionsRole.orgId);
        assert.strictEqual(roleDef.name, optionsRole.name);
        assert.deepStrictEqual(roleDef.permissions, optionsRole.permissions);
        assert.deepStrictEqual(roleDef.paramMapping, optionsRole.paramMapping);
    });

    it('check changeName works', function () {
        const role = new RoleDefinition(optionsRole);
        assert.throws(() => role.changeName(), RoleDefinitionError);
        assert.throws(() => role.changeName({}), RoleDefinitionError);
        const newName = 'roleName2';
        role.changeName(newName);
        assert.strictEqual(role.name, newName);
    });

    it('check changeParamsMapping works', function () {
        const role = new RoleDefinition(optionsDefaultRole);
        assert.throws(() => role.changeParamsMapping(), RoleDefinitionError);
        assert.throws(() => role.changeParamsMapping({}), RoleDefinitionError);
        const newMapping = {
            'orgId': {
                name: 'OrganizationId',
                description: 'The id of the organization the user belongs to',
                mapping: `${permDef1.scope}:${permDef1.name}:orgId`,
            }
        };
        role.changeParamsMapping(newMapping);
        assert.strictEqual(role.paramMapping, newMapping);
    });

    it('check changePermissions works', function () {
        const role = new RoleDefinition(optionsRole);
        assert.throws(() => role.changePermissions(), RoleDefinitionError);
        assert.throws(() => role.changePermissions({}), RoleDefinitionError);
        assert.throws(() => role.changePermissions([0]), RoleDefinitionError);
        assert.throws(() => role.changePermissions(['0']), RoleDefinitionError);
        assert.throws(() => role.changePermissions([{}]), RoleDefinitionError);
        assert.throws(() => role.changePermissions([permDef2]), RoleDefinitionError);
        const newPerm = new PermissionDefinition({ scope: 'auth-service', name: 'removeRole' });
        role.changePermissions([permDef1, newPerm]);
        assert.deepStrictEqual(role.permissions, [permDef1, newPerm]);
        role.changePermissions([newPerm]);
        assert.deepStrictEqual(role.permissions, [newPerm]);
    });

    it('check toRole works', function () {
        const roleDef = new RoleDefinition(optionsRole);
        assert.throws(() => roleDef.toRole(), RoleDefinitionError);
        assert.throws(() => roleDef.toRole(1), RoleDefinitionError);
        assert.throws(() => roleDef.toRole({}), RoleDefinitionError);

        const role = roleDef.toRole({ orgId: 'org1' });
        assert.ok(role instanceof Role);
        assert.deepStrictEqual(role.paramValues, {
            orgId: {
                value: 'org1',
                mapping: optionsRole.paramMapping.orgId.mapping,
                name: optionsRole.paramMapping.orgId.name,
                description: optionsRole.paramMapping.orgId.description,
                required: optionsRole.paramMapping.orgId.required,
            }
        });
    });

    it('check fromObject works', function () {
        assert.throws(() => RoleDefinition.fromObject(), RoleDefinitionError);
        const obj = Object.assign({}, optionsDefaultRole, { permissions: JSON.parse(JSON.stringify(optionsDefaultRole.permissions)) });
        const roleDef = RoleDefinition.fromObject(obj);
        assert.strictEqual(roleDef.roleDefId, optionsDefaultRole.roleDefId);
        assert.strictEqual(roleDef.orgId, 'default');
        assert.strictEqual(roleDef.name, optionsDefaultRole.name);
        assert.strictEqual(roleDef.description, optionsDefaultRole.description);
        assert.deepStrictEqual(roleDef.permissions, optionsDefaultRole.permissions);
        assert.deepStrictEqual(roleDef.paramMapping, optionsDefaultRole.paramMapping);
    });
});
