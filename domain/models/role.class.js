const uuid = require('uuid/v4');
const Permission = require('./permission.class');
const RoleError = require('../errors/role.error');

class Role {
    /**
     * @constructor
     * @param {string} name The name of the Role
     * @param {Permission[]} [permissions] The list of permission of this Role
     */
    constructor(name, permissions) {
        this._checkName(name);
        this.roleId = uuid();
        this.name = name;
        if (permissions)
            this._checkArrayOfPermissions(permissions);
        this.permissions = permissions || [];
    }

    /**
     * @param {Object} obj 
     * @param {string} obj.roleId
     * @param {string} obj.name
     * @param {Object[]} obj.permissions
     * @param {string} obj.permissions[].scope
     * @param {string} obj.permissions[].name
     * @param {string} obj.permissions[].description
     */
    static fromObject(obj) {
        if (!obj)
            throw RoleError.paramError('Missing the following parameters: obj');
        const permissions = obj.permissions.map(p => Permission.fromObject(p));
        const role = new Role(obj.name, permissions);
        role.roleId = obj.roleId;
        return role;
    }

    _checkArrayOfPermissions(permissions) {
        if (!Array.isArray(permissions) || (permissions.length > 0 && !(permissions[0] instanceof Permission)))
            throw new RoleError('permissions must be an array of Permission instances');
    }

    _checkName(name) {
        if (!name)
            throw new RoleError(`Missing the following parameters:${name ? '' : ' name'}`);
        if (typeof name !== 'string')
            throw new RoleError('name must be a string');
    }

    changeName(name) {
        this._checkName(name);
        this.name = name;
    }

    changePermissions(permissions) {
        this._checkArrayOfPermissions(permissions);
        this.permissions = permissions;
    }

    get id() {
        return this.roleId;
    }
}

module.exports = Role;
