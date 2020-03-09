const assert = require('assert');
const Permission = require('../../domain/models/permission.class');
const Role = require('../../domain/models/role.class');
const RoleError = require('../../domain/errors/role.error');

describe('Role class unit test', function () {
    const perm = new Permission('auth-service', 'addRole');
    const roleId = 'id1';
    const name = 'waiter';

    it('check constructor works', function () {
        assert.throws(() => new Role(), RoleError);
        assert.throws(() => new Role({}), RoleError);
        assert.throws(() => new Role(name, ['perm1']), RoleError);
        assert.throws(() => new Role(name, [{}]), RoleError);

        let role = new Role(name);
        assert.strictEqual(role.name, name);
        assert.ok(typeof role.roleId === 'string');

        role = new Role(name, [perm]);
        assert.deepStrictEqual(role.permissions, [perm]);
    });

    it('check fromObject works', function () {
        assert.throws(() => Role.fromObject(), RoleError);
        const obj = {
            roleId,
            name,
            permissions: [JSON.parse(JSON.stringify(perm))]
        };
        const role = Role.fromObject(obj);
        assert.strictEqual(role.roleId, obj.roleId);
        assert.strictEqual(role.name, obj.name);
        assert.deepStrictEqual(role.permissions, [perm]);
    });
});
