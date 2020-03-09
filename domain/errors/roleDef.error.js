const ExtendableError = require('../../lib/extendable_error.error');

const errorsTypes = {
    paramError: {
        code: 0,
        name: 'paramError',
    },
    /* paramMappingsError: {
        code: 1,
        name: 'paramMappingsError',
    }, */
};

class RoleDefinitionError extends ExtendableError {
    
    static get errors() {
        return errorsTypes;
    }

    static paramError(msg) {
        return new RoleDefinitionError(msg, RoleDefinitionError.paramErrorCode);
    }

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }
}

module.exports = RoleDefinitionError;
