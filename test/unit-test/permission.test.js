const assert = require('assert');
const Permission = require('../../domain/models/permission.class');
const PermissionError = require('../../domain/errors/permission.error');

describe('Permission class unit test', function () {
    const scope = 'auth-service';
    const name = 'addRole';
    const description = 'Adds a role to organization';
    const paramValues = {
        param1: 'value1'
    };

    it('check constructor works', function () {
        assert.throws(() => new Permission(), PermissionError);
        assert.throws(() => new Permission({}), PermissionError);
        assert.throws(() => new Permission(name), PermissionError);
        assert.throws(() => new Permission(name, {}), PermissionError);
        assert.throws(() => new Permission(name, scope, {}), PermissionError);

        let perm = new Permission(scope, name);
        assert.strictEqual(perm.scope, scope);
        assert.strictEqual(perm.name, name);
        assert.deepStrictEqual(perm.parameters, {});

        perm = new Permission(scope, name, description, paramValues);
        assert.strictEqual(perm.description, description);
        assert.deepStrictEqual(perm.parameters, paramValues);
    });

    it('check fromObject works', function () {
        assert.throws(() => Permission.fromObject(), PermissionError);
        const obj = {
            scope,
            name,
            description,
            parameters: paramValues,
        };
        const perm = Permission.fromObject(obj);
        assert.strictEqual(perm.scope, obj.scope);
        assert.strictEqual(perm.name, obj.name);
        assert.strictEqual(perm.description, description);
        assert.deepStrictEqual(perm.parameters, paramValues);
    });
});
