const PermissionError = require('../errors/permission.error');

class Permission {
    /**
     * @constructor
     * @param {string} scope The scope of the permission
     * @param {string} name The name of the permission
     * @param {string} [description] The description, tells which actions the permission allows
     */
    constructor(scope, name, description) {
        if (!scope || !name)
            throw PermissionError.paramError(`Missing the following parameters:${scope ? '' : ' scope'}${name ? '' : ' name'}`);
        if (typeof scope !== 'string')
            throw PermissionError.paramError('scope must be a string');
        if (typeof name !== 'string')
            throw PermissionError.paramError('name must be a string');
        if (description && typeof description !== 'string')
            throw PermissionError.paramError('description must be a string');
        this.scope = scope;
        this.name = name;
        this.description = description;
    }

    /**
     * @param {Object} obj
     * @param {string} obj.scope
     * @param {string} obj.name
     * @param {string} obj.description
     */
    static fromObject(obj) {
        if (!obj)
            throw PermissionError.paramError('Missing the following parameters: obj');
        return new Permission(obj.scope, obj.name, obj.description);
    }
}

module.exports = Permission;
