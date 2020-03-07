const Permission = require('./permission.class');
const PermissionDefinitionError = require('../errors/permissionDef.error');

class PermissionDefinition {
    /**
     * @constructor
     * @param {Object} options
     * @param {string} options.scope The scope of the permission
     * @param {string} options.name The name of the permission
     * @param {string} [options.description] The description, tells which actions the permission allows
     * @param {Object} [options.parameters] The parameters of the permission
     * @param {Object} options.parameters.param_id The parameter id
     * @param {string} [options.parameters.param_id.name] The readable parameter name
     * @param {string} [options.parameters.param_id.description] The parameter description
     * @param {boolean} [options.parameters.param_id.required] Whether if the parameter is required or not
     */
    constructor(options = {}) {
        this._checkOptions(options);
        const { scope, name, description, parameters } = options;
        this.scope = scope;
        this.name = name;
        this.description = description;
        this.parameters = this._buildParamters(parameters);
    }

    _checkOptions(options) {
        const { scope, name, description, parameters } = options;
        if (!scope || !name)
            throw PermissionDefinitionError.paramError(`Missing the following parameters:${scope ? '' : ' scope'}${name ? '' : ' name'}`);
        if (typeof scope !== 'string')
            throw PermissionDefinitionError.paramError('scope must be a string');
        if (typeof name !== 'string')
            throw PermissionDefinitionError.paramError('name must be a string');
        if (description && typeof description !== 'string')
            throw PermissionDefinitionError.paramError('description must be a string');
        this._checkParameters(parameters);
    }

    _checkParameters(parameters = {}) {
        Object.keys(parameters).forEach(k => {
            if (parameters[k].name && typeof parameters[k].name !== 'string')
                throw PermissionDefinitionError.paramError(`parameters definition not valid: value of ${k}.name must be a string`);
            if (parameters[k].description && typeof parameters[k].description !== 'string')
                throw PermissionDefinitionError.paramError(`parameters definition not valid: value of ${k}.description must be a string`);
            if (parameters[k].required && typeof parameters[k].required !== 'boolean')
                throw PermissionDefinitionError.paramError(`parameters definition not valid: value of ${k}.required must be a boolean`);
        });
    }

    _buildParamters(parameters = {}) {
        // for each param name it transform it to ${scope}:${permissionName}:${parameter} to avoid conflicts
        const paramNameRegExp = new RegExp(`${this.scope}:${this.name}:(\\w+)`);
        const params = {};
        Object.keys(parameters).forEach(k => {
            if (paramNameRegExp.test(k))
                params[k] = parameters[k];
            else {
                const newKey = `${this.scope}:${this.name}:${k}`;
                params[newKey] = parameters[k];
            }
        });
        return params;
    }

    /**
     * @param {Object} obj
     * @param {string} obj.scope
     * @param {string} obj.name
     * @param {string} obj.description
     */
    static fromObject(obj) {
        if (!obj)
            throw PermissionDefinitionError.paramError('Missing the following parameters: obj');
        return new PermissionDefinition(obj);
    }

    /**
     * 
     * @param {Object} paramValues 
     * @param {any} paramValues.param_id 
     * @returns {Permission}
     */
    toPermission(paramValues) {
        const paramNameRegExp = new RegExp(`${this.scope}:${this.name}:(\\w+)`);
        const values = {};
        Object.keys(this.parameters).forEach(k => {
            const paramName = paramNameRegExp.exec(k)[1];
            if (!paramValues[k] && !paramValues[paramName] && this.parameters[k].required)
                throw PermissionDefinition.paramError(`Missing required paramters for permission: ${k}`);
            values[paramName] = paramValues[paramName] || paramValues[k];
        });
        return new Permission(this.scope, this.name, this.description, values);
    }
}

module.exports = PermissionDefinition;
