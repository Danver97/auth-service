const ExtendableError = require('../../lib/extendable_error.error');

const errorsTypes = {
    paramError: {
        code: 0,
        name: 'paramError',
    },
};

class UserError extends ExtendableError {
    
    static get errors() {
        return errorsTypes;
    }

    static paramError(msg) {
        return new UserError(msg, UserError.paramErrorCode);
    }

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }
}

module.exports = UserError;
