const uuid = require('uuid/v4');
const Role = require('./role.class');
const PermissionDefinition = require('./permissionDef.class');
const RoleDefinitionError = require('../errors/roleDef.error');

class RoleDefinition {
    /**
     * @constructor
     * @param {Object} options 
     * @param {string} [options.roleDefId] The id of the RoleDefinition
     * @param {string} [options.orgId] The id of the RoleDefinition
     * @param {string} options.name The name of the RoleDefinition
     * @param {string} [options.description] The description of the RoleDefinition
     * @param {Object} options.paramMapping The parameterMapping of the RoleDefinition
     * @param {Object} options.paramMapping.param_id id of the RoleDefinition parameter
     * @param {string} [options.paramMapping.param_id.name] Readable name of the RoleDefinition parameter
     * @param {string} [options.paramMapping.param_id.description] Description of the RoleDefinition parameter
     * @param {string} [options.paramMapping.param_id.required] true/false, tells if the RoleDefinition parameter is required
     * @param {string} options.paramMapping.param_id.mapping The parameter of the PermissionDefinition to which this RoleDefinition parameter is mapped
     * @param {PermissionDefinition[]} [options.permissions] The list of PermissionDefinition of this RoleDefinition
     */
    constructor(options = {}) {
        this._checkOptions(options);
        this.roleDefId = options.orgId ? uuid() : options.roleDefId;
        this.orgId = options.roleDefId ? 'default' : options.orgId;
        this.name = options.name;
        this.description = options.description;
        this.paramMapping = options.paramMapping;
        this.permissions = options.permissions || [];
        this.paramReverseMapping = this._buildReverseMapping(this.paramMapping);
        this._checkForMissingParameters(this.paramReverseMapping, this.permissions);
    }

    /**
     * @param {Object} obj 
     * @param {string} [obj.roleDefId]
     * @param {string} [obj.orgId]
     * @param {string} obj.name
     * @param {Object[]} obj.permissions
     * @param {string} obj.permissions[].scope
     * @param {string} obj.permissions[].name
     * @param {string} obj.permissions[].description
     * @param {Object} obj.paramMapping The parameterMapping of the RoleDefinition
     * @param {Object} obj.paramMapping.param_id id of the RoleDefinition parameter
     * @param {string} [obj.paramMapping.param_id.name] Readable name of the RoleDefinition parameter
     * @param {string} [obj.paramMapping.param_id.description] Description of the RoleDefinition parameter
     * @param {string} [obj.paramMapping.param_id.required] true/false, tells if the RoleDefinition parameter is required
     * @param {string} obj.paramMapping.param_id.mapping The parameter of the PermissionDefinition to which this RoleDefinition parameter is mapped
     */
    static fromObject(obj) {
        if (!obj)
            throw RoleDefinitionError.paramError('Missing the following parameters: obj');
        obj.permissions = obj.permissions.map(p => PermissionDefinition.fromObject(p));
        const role = new RoleDefinition(obj);
        role.roleDefId = obj.roleDefId;
        return role;
    }

    _checkOptions(options) {
        this._checkOrgIdRoleId(options);
        this._checkName(options.name);
        this._checkParamMapping(options.paramMapping);
        if (options.permissions)
            this._checkArrayOfPermissions(options.permissions);
    }

    _checkOrgIdRoleId(options) {
        if ((!options.orgId && !options.roleDefId) || (options.orgId && options.roleDefId))
            throw RoleDefinitionError.paramError(`Missing parameters: required only one between options.orgId and options.roleDefId`);
        if (options.orgId && typeof options.orgId !== 'string')
            throw RoleDefinitionError.paramError('options.orgId must be a string');
        if (options.roleDefId && typeof options.roleDefId !== 'string')
            throw RoleDefinitionError.paramError('options.roleDefId must be a string');
    }

    _checkName(name) {
        if (!name)
            throw RoleDefinitionError.paramError(`Missing the following parameters:${name ? '' : ' options.name'}`);
        if (typeof name !== 'string')
            throw RoleDefinitionError.paramError('options.name must be a string');
    }

    _checkParamMapping(paramMapping) {
        if (!paramMapping)
            throw RoleDefinitionError.paramError(`Missing options.paramMapping`);
        Object.values(paramMapping).forEach(p => {
            if (p.name && typeof p.name !== 'string')
                throw RoleDefinitionError.paramError(`The param mapping property 'name' must be a string`);
            if (p.description && typeof p.description !== 'string')
                throw RoleDefinitionError.paramError(`The param mapping property 'description' must be a string`);
            if (!p.mapping || typeof p.mapping !== 'string')
                throw RoleDefinitionError.paramError(`The param mapping property 'mapping' must be a string. The property is required`);
        });
    }

    _checkArrayOfPermissions(permissions) {
        if (!Array.isArray(permissions) || (permissions.length > 0 && !(permissions[0] instanceof PermissionDefinition)))
            throw RoleDefinitionError.paramError('options.permissions must be an array of PermissionDefinition instances');
    }

    _buildReverseMapping(paramMapping) {
        const paramReverseMapping = {};
        Object.entries(paramMapping).forEach(([key, value]) => {
            paramReverseMapping[value.mapping] = { revMapping: key, required: value.required };
        });
        return paramReverseMapping;
    }

    _checkForMissingParameters(paramReverseMapping, permissions) {
        const permissionsParamsList = permissions.map(p => Object.keys(p.parameters).filter(k => p.parameters[k].required)).flat();
        const missingParmeters = permissionsParamsList.filter(p => (!paramReverseMapping[p] || !paramReverseMapping[p].required));
        if (missingParmeters.length > 0)
            throw RoleDefinitionError.paramError(`Params mapping not well created, following required parameters were used in the permission list, but not in the param mapping: ${missingParmeters}`);
    }

    changeName(name) {
        this._checkName(name);
        this.name = name;
    }

    changeParamsMapping(paramMapping) {
        this._checkParamMapping(paramMapping);
        const paramReverseMapping = this._buildReverseMapping(paramMapping);
        this._checkForMissingParameters(paramReverseMapping, this.permissions);
        this.paramMapping = paramMapping;
        this.paramReverseMapping = paramReverseMapping;
    }

    changePermissions(permissions) {
        this._checkArrayOfPermissions(permissions);
        this._checkForMissingParameters(this.paramReverseMapping, permissions);
        this.permissions = permissions;
    }

    /**
     * 
     * @param {object} paramValues 
     * @param {string|number|boolean|object} paramValues.param_id 
     */
    toRole(paramValues = {}) {
        const missingParmeters = Object.values(this.paramReverseMapping)
            .filter(v => (v.required && !paramValues[v.revMapping]))
            .map(v => v.revMapping);
        if (missingParmeters.length > 0)
            throw RoleDefinitionError.paramError(`paramValues is missing the following required values: ${missingParmeters}`);
        const values = {};
        Object.keys(paramValues).forEach(k => {
            values[k] = Object.assign({ value: paramValues[k] }, this.paramMapping[k]);
        });
        const permissions = this.permissions.map(p => p.toPermission(paramValues));
        return new Role(this.name, permissions, values);
    }

    get id() {
        return this.roleDefId;
    }
}

module.exports = RoleDefinition;
