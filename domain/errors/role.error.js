const ExtendableError = require('../../lib/extendable_error.error');

const errorsTypes = {
    paramError: {
        code: 0,
        name: 'paramError',
    },
};

class RoleError extends ExtendableError {
    
    static get errors() {
        return errorsTypes;
    }

    static paramError(msg) {
        return new RoleError(msg, RoleError.paramErrorCode);
    }

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }
}

module.exports = RoleError;
