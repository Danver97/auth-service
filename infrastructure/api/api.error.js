const ExtendableError = require('../../lib/extendable_error.error');

const errorsTypes = {
    paramError: {
        code: 0,
        name: 'paramError',
    },
    noTokenError: {
        code: 10,
        name: 'noTokenError',
    },
    invalidTokenError: {
        code: 11,
        name: 'invalidTokenError',
    },
    tokenExpiredError: {
        code: 12,
        name: 'tokenExpiredError',
    },
    notAuthorizedError: {
        code: 13,
        name: 'notAuthorizedError',
    },
};

class ApiError extends ExtendableError {
    
    static get errors() {
        return errorsTypes;
    }

    static paramError(msg) {
        return new ApiError(msg, ApiError.paramErrorCode);
    }

    static noTokenError(msg) {
        return new ApiError(msg, ApiError.noTokenErrorCode);
    }

    static tokenExpiredError(msg) {
        return new ApiError(msg, ApiError.tokenExpiredErrorCode);
    }

    static invalidTokenError(msg) {
        return new ApiError(msg, ApiError.invalidTokenErrorCode);
    }

    static notAuthorizedError(msg) {
        return new ApiError(msg, ApiError.notAuthorizedErrorCode);
    }

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }

    static get noTokenErrorCode() {
        return errorsTypes.noTokenError.code;
    }

    static get invalidTokenErrorCode() {
        return errorsTypes.invalidTokenError.code;
    }

    static get tokenExpiredErrorCode() {
        return errorsTypes.tokenExpiredError.code;
    }

    static get notAuthorizedErrorCode() {
        return errorsTypes.notAuthorizedError.code;
    }
}

module.exports = ApiError;
