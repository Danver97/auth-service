const ExtendableError = require('../../lib/extendable_error.error');

const errorsTypes = {
    paramError: {
        code: 0,
        name: 'paramError',
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
        return new OrganizationError(msg, OrganizationError.paramErrorCode);
    }

    static optimisticLockingError(msg) {
        return new OrganizationError(msg, OrganizationError.optimisticLockingErrorCode);
    }

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }
    
    static get optimisticLockingErrorCode() {
        return errorsTypes.optimisticLockingError.code;
    }
}

module.exports = RepositoryError;
