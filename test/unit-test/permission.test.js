const assert = require('assert');
const Permission = require('../../domain/models/permission.class');
const PermissionError = require('../../domain/errors/permission.error');

describe('Permission class unit test', function () {
    const scope = 'auth-service';
    const name = 'addRole';
    const description = 'Adds a role to organization';

    it('check constructor works', function () {
        assert.throws(() => new Permission(), PermissionError);
        assert.throws(() => new Permission({}), PermissionError);
        assert.throws(() => new Permission(name), PermissionError);
        assert.throws(() => new Permission(name, {}), PermissionError);
        assert.throws(() => new Permission(name, scope, {}), PermissionError);

        let perm = new Permission(scope, name);
        assert.strictEqual(perm.scope, scope);
        assert.strictEqual(perm.name, name);

        perm = new Permission(scope, name, description);
        assert.deepStrictEqual(perm.description, description);
    });

    it('check fromObject works', function () {
        assert.throws(() => Permission.fromObject(), PermissionError);
        const obj = {
            scope,
            name,
            description,
        };
        const perm = Permission.fromObject(obj);
        assert.strictEqual(perm.scope, obj.scope);
        assert.strictEqual(perm.name, obj.name);
        assert.strictEqual(perm.description, description);
    });
});
