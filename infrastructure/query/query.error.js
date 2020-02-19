const ExtendableError = require('../../lib/extendable_error.error');

const errorsTypes = {
    paramError: {
        code: 0,
        name: 'paramError',
    },
    notFound: {
        code: 1,
        name: 'notFound',
    },
};

class QueryError extends ExtendableError {
    
    static get errors() {
        return errorsTypes;
    }

    static paramError(msg) {
        return new QueryError(msg, QueryError.paramErrorCode);
    }

    static notFound(msg) {
        return new QueryError(msg, QueryError.notFoundCode);
    }

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }

    static get notFoundCode() {
        return errorsTypes.notFound.code;
    }
}

module.exports = QueryError;
