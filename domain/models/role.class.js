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

    get id() {
        return this.roleId;
    }
}

module.exports = Role;
