const assert = require('assert');
const Permission = require('../../domain/models/permission.class');
const PermissionDefinition = require('../../domain/models/permissionDef.class');
const PermissionDefinitionError = require('../../domain/errors/permissionDef.error');


describe('PermissionDefinition class unit test', function () {
    const options1 = {
        scope: 'auth-service',
        name: 'addRole',
    };
    const options2 = {
        scope: 'auth-service',
        name: 'addRole',
        description: 'Allows to add a role to organization',
        parameters: {
            orgId: {
                name: 'Organization id',
                description: 'The organization id',
                required: true,
            },
            'auth-service:addRole:orgName': {},
        }
    };
    const paramValues = {
        'auth-service:addRole:orgId': 'org1',
        orgName: 'provaOrg1',
    };

    it('check constructor works', function () {
        assert.throws(() => new PermissionDefinition(), PermissionDefinitionError);
        assert.throws(() => new PermissionDefinition('bla'), PermissionDefinitionError);
        assert.throws(() => new PermissionDefinition({}), PermissionDefinitionError);
        assert.throws(() => new PermissionDefinition({ name: 'perm1' }), PermissionDefinitionError);
        assert.throws(() => new PermissionDefinition({ scope: 'service1' }), PermissionDefinitionError);
        assert.throws(() => new PermissionDefinition({ scope: 'service1', name: 'perm1', parameters: { p1: { name: 1 } } }), PermissionDefinitionError);
        assert.throws(() => new PermissionDefinition({ scope: 'service1', name: 'perm1', parameters: { p1: { description: 1 } } }), PermissionDefinitionError);
        assert.throws(() => new PermissionDefinition({ scope: 'service1', name: 'perm1', parameters: { p1: { required: 1 } } }), PermissionDefinitionError);

        let permDef = new PermissionDefinition(options1);
        assert.strictEqual(permDef.scope, options1.scope);
        assert.strictEqual(permDef.name, options1.name);
        assert.deepStrictEqual(permDef.parameters, {});
        // assert.strictEqual(perm.description, options.description);

        permDef = new PermissionDefinition(options2);
        assert.deepStrictEqual(permDef.description, options2.description);
        assert.deepStrictEqual(permDef.parameters, {
            'auth-service:addRole:orgId': {
                name: 'Organization id',
                description: 'The organization id',
                required: true,
            },
            'auth-service:addRole:orgName': {},
        });
    });

    it('check toPermission works', function () {
        const permDef = new PermissionDefinition(options2);
        const perm = permDef.toPermission(paramValues);
        assert.ok(perm instanceof Permission);
        assert.deepStrictEqual(perm.paramValues, {
            orgId: paramValues['auth-service:addRole:orgId'],
            orgName: paramValues.orgName,
        });
        
    });

    it('check fromObject works', function () {
        assert.throws(() => PermissionDefinition.fromObject(), PermissionDefinitionError);
        const obj = {
            scope: 'auth-service',
            name: 'addRole',
            description: 'Allows to add a role to organization',
            parameters: {
                orgId: {
                    name: 'Organization id',
                    description: 'The organization id',
                    required: true,
                },
                'auth-service:addRole:orgName': {},
            }
        };
        const perm = PermissionDefinition.fromObject(obj);
        assert.ok(perm instanceof PermissionDefinition);
        assert.strictEqual(perm.scope, obj.scope);
        assert.strictEqual(perm.name, obj.name);
        assert.strictEqual(perm.description, obj.description);
        assert.deepStrictEqual(perm.parameters, {
            'auth-service:addRole:orgId': {
                name: 'Organization id',
                description: 'The organization id',
                required: true,
            },
            'auth-service:addRole:orgName': {},
        });
    });
});
