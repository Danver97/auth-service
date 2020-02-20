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

    it('check changeName works', function () {
        const role = new Role(name);
        assert.throws(() => role.changeName(), RoleError);
        assert.throws(() => role.changeName({}), RoleError);
        const newName = 'roleName2';
        role.changeName(newName);
        assert.strictEqual(role.name, newName);
    });

    it('check changeName works', function () {
        const role = new Role(name);
        assert.throws(() => role.changePermissions(), RoleError);
        assert.throws(() => role.changePermissions({}), RoleError);
        assert.throws(() => role.changePermissions([0]), RoleError);
        assert.throws(() => role.changePermissions(['0']), RoleError);
        assert.throws(() => role.changePermissions([{}]), RoleError);
        const newPerm = new Permission('auth-service', 'removeRole');
        role.changePermissions([perm, newPerm]);
        assert.deepStrictEqual(role.permissions, [perm, newPerm]);
        role.changePermissions([newPerm]);
        assert.deepStrictEqual(role.permissions, [newPerm]);
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
