const ExtendableError = require('../../lib/extendable_error.error');

const errorsTypes = {
    paramError: {
        code: 0,
        name: 'paramError',
    },
    organizationStreamNotFoundError: {
        code: 1,
        name: 'organizationStreamNotFoundError',
    },
    userStreamNotFoundError: {
        code: 2,
        name: 'userStreamNotFoundError',
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

    static organizationStreamNotFoundError(msg) {
        return new RepositoryError(msg, RepositoryError.organizationStreamNotFoundErrorCode);
    }

    static userStreamNotFoundError(msg) {
        return new RepositoryError(msg, RepositoryError.userStreamNotFoundErrorCode);
    }

    static optimisticLockingError(msg) {
        return new RepositoryError(msg, RepositoryError.optimisticLockingErrorCode);
    }

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }

    static get organizationStreamNotFoundErrorCode() {
        return errorsTypes.organizationStreamNotFoundError.code;
    }

    static get userStreamNotFoundErrorCode() {
        return errorsTypes.userStreamNotFoundError.code;
    }
    
    static get optimisticLockingErrorCode() {
        return errorsTypes.optimisticLockingError.code;
    }
}

module.exports = RepositoryError;
