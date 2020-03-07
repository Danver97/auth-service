const PermissionError = require('../errors/permission.error');

class Permission {
    /**
     * @constructor
     * @param {string} scope The scope of the permission
     * @param {string} name The name of the permission
     * @param {string} [description] The description, tells which actions the permission allows
     * @param {Object} [paramValues] The parameters defined in its definition with their values
     */
    constructor(scope, name, description, paramValues) {
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
        this.paramValues = paramValues || {};
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
        return new Permission(obj.scope, obj.name, obj.description, obj.paramValues);
    }
}

module.exports = Permission;
