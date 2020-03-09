const assert = require('assert');
const Role = require('../../domain/models/role.class');
const RoleInstance = require('../../domain/models/roleInstance.class');
const PermissionDefinition = require('../../domain/models/permissionDef.class');
const RoleDefinition = require('../../domain/models/roleDef.class');
const RoleInstanceError = require('../../domain/errors/roleInstance.error');
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
    let roleDef = new RoleDefinition(optionsDefaultRole);

    beforeEach(() => {
        roleDef = new RoleDefinition(optionsDefaultRole);
    });

    it('check constructor works', function () {
        assert.throws(() => new RoleInstance(), RoleInstanceError);
        assert.throws(() => new RoleInstance({ roleDef }), RoleInstanceError);

        const roleInstance = new RoleInstance({ roleDef, paramValues: { orgId: 'org1' } });
        assert.ok(roleInstance.roleDef instanceof RoleDefinition);
        assert.deepStrictEqual(roleInstance.roleDef, roleDef);
        assert.deepStrictEqual(roleInstance.paramValues, { orgId: 'org1' });
    });

    it('check toRole works', function () {
        const roleInstance = new RoleInstance({ roleDef, paramValues: { orgId: 'org1' } });
        const role = roleInstance.toRole();
        assert.ok(role instanceof Role);
    });

});