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

    static get paramError() {
        return errorsTypes.paramError.code;
    }

    static get notFound() {
        return errorsTypes.notFound.code;
    }
}

module.exports = QueryError;
