const ExtendableError = require('../../lib/extendable_error.error');

const errorsTypes = {
    paramError: {
        code: 0,
        name: 'paramError',
    },
    streamNotFoundError: {
        code: 1,
        name: 'streamNotFoundError',
    },
    optimisticLockingError: {
        code: 10,
        name: 'optimisticLockingError',
    },
};

class RepositoryError extends ExtendableError {
    
    static get errors() {
        return errorsTypes;
    }

    static paramError(msg) {
        return new RepositoryError(msg, RepositoryError.paramErrorCode);
    }

    static streamNotFound(msg) {
        return new RepositoryError(msg, RepositoryError.streamNotFoundErrorCode);
    }

    static optimisticLockingError(msg) {
        return new RepositoryError(msg, RepositoryError.optimisticLockingErrorCode);
    }

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }

    static get streamNotFoundErrorCode() {
        return errorsTypes.streamNotFoundError.code;
    }
    
    static get optimisticLockingErrorCode() {
        return errorsTypes.optimisticLockingError.code;
    }
}

module.exports = RepositoryError;
