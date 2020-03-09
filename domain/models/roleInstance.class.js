const RoleDefinition = require('./roleDef.class');
const RoleError = require('../errors/role.error');

class RoleInstance {
    /**
     * @constructor
     * @param {object} options
     * @param {RoleDefinition} options.roleDef
     * @param {object} [options.paramValues]
     * @param {string|number|boolean|object} options.paramValues.param_id
     */
    constructor(options = {}) {
        const { roleDef, paramValues = {} } = options;
        this._checkOptions(options);
        this.roleDef = roleDef;
        this.paramValues = paramValues || {};
    }

    /**
     * @param {Object} obj 
     * @param {object} obj.roleDef
     * @param {Object} [obj.paramValues]
     * @param {string|number|boolean|object} obj.paramValues.param_id
     */
    static fromObject(obj) {
        if (!obj)
            throw RoleError.paramError('Missing the following parameters: obj');
        const roleDef = RoleDefinition.fromObject(obj.roleDef);
        const roleInstance = new RoleInstance({ roleDef, paramValues: obj.paramValues });
        return roleInstance;
    }

    _checkOptions(options) {
        const { roleDef, paramValues = {} } = options;
        if (!(roleDef instanceof RoleDefinition))
            throw RoleError.paramError('options.roleDef must be an instance of RoleDefinition');
        this._checkParamValues(roleDef, paramValues);
    }

    _checkParamValues(roleDef, paramValues = {}) {
        const missingParams = Object.entries(roleDef.paramMapping).filter(([param_id, param]) => (!paramValues[param_id] && param.required));
        if (missingParams.length > 0)
            throw RoleError.paramError(`Missing the following required paramters: ${missingParams}`);
    }

    toJSON() {
        return {
            orgId: this.roleDef.orgId,
            roleDefId: this.roleDef.roleDefId,
            paramValues: this.paramValues,
        }
    }

    toRole() {
        return this.roleDef.toRole(this.paramValues);
    }
}

module.exports = RoleInstance;
