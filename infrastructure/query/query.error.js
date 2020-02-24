const ExtendableError = require('../../lib/extendable_error.error');

const errorsTypes = {
    paramError: {
        code: 0,
        name: 'paramError',
    },
    /* notFoundError: {
        code: 1,
        name: 'notFoundError',
    }, */
    organizationNotFoundError: {
        code: 2,
        name: 'organizationNotFoundError',
    },
    roleNotFoundError: {
        code: 3,
        name: 'roleNotFoundError',
    },
    userNotFoundError: {
        code: 4,
        name: 'userNotFoundError',
    },
};

class QueryError extends ExtendableError {
    
    static get errors() {
        return errorsTypes;
    }

    static paramError(msg) {
        return new QueryError(msg, QueryError.paramErrorCode);
    }

    /* static notFoundError(msg) {
        return new QueryError(msg, QueryError.notFoundErrorCode);
    } */

    static organizationNotFoundError(msg) {
        return new QueryError(msg, QueryError.organizationNotFoundErrorCode);
    }

    static roleNotFoundError(msg) {
        return new QueryError(msg, QueryError.roleNotFoundErrorCode);
    }

    static userNotFoundError(msg) {
        return new QueryError(msg, QueryError.userNotFoundErrorCode);
    }

    // Codes

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }

    /* static get notFoundErrorCode() {
        return errorsTypes.notFoundError.code;
    } */

    static get organizationNotFoundErrorCode() {
        return errorsTypes.organizationNotFoundError.code;
    }

    static get roleNotFoundErrorCode() {
        return errorsTypes.roleNotFoundError.code;
    }

    static get userNotFoundErrorCode() {
        return errorsTypes.userNotFoundError.code;
    }
}

module.exports = QueryError;
