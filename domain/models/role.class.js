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
        if (!name)
            throw new RoleError(`Missing the following parameters:${name ? '' : ' name'}`);
        this.roleId = uuid();
        this.name = name;
        if (permissions && (!Array.isArray(permissions) || (permissions.length > 0 && !(permissions[0] instanceof Permission))))
            throw new RoleError('permissions must be an array of Permission instances');
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
        const permissions = obj.permissions.map(p => Permission.fromObject(p));
        const role = new Role(obj.name, permissions);
        role.roleId = obj.roleId;
        return role;
    }

    get id() {
        return this.roleId;
    }
}

module.exports = Role;
