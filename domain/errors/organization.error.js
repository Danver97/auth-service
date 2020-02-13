const ExtendableError = require('../../lib/extendable_error.error');

const errorsTypes = {
    paramError: {
        code: 0,
        name: 'paramError',
    },
    roleAlreadyExistsError: {
        code: 10,
        name: 'roleAlreadyExistsError',
    },
    roleDoesNotExistError: {
        code: 11,
        name: 'roleDoesNotExistError',
    },
    userAlreadyExistsError: {
        code: 20,
        name: 'userAlreadyExistsError',
    },
    userDoesNotExistError: {
        code: 21,
        name: 'userDoesNotExistError',
    },
};

class OrganizationError extends ExtendableError {
    
    static get errors() {
        return errorsTypes;
    }

    static paramError(msg) {
        return new OrganizationError(msg, OrganizationError.paramErrorCode);
    }

    static roleAlreadyExistsError(msg) {
        return new OrganizationError(msg, OrganizationError.roleAlreadyExistsErrorCode);
    }

    static roleDoesNotExistError(msg) {
        return new OrganizationError(msg, OrganizationError.roleDoesNotExistErrorCode);
    }

    static userAlreadyExistsError(msg) {
        return new OrganizationError(msg, OrganizationError.userAlreadyExistsErrorCode);
    }

    static userDoesNotExistError(msg) {
        return new OrganizationError(msg, OrganizationError.userDoesNotExistErrorCode);
    }

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }
    
    static get roleAlreadyExistsErrorCode() {
        return errorsTypes.roleAlreadyExistsError.code;
    }

    static get roleDoesNotExistErrorCode() {
        return errorsTypes.roleDoesNotExistError.code;
    }
    
    static get userAlreadyExistsErrorCode() {
        return errorsTypes.userAlreadyExistsError.code;
    }

    static get userDoesNotExistErrorCode() {
        return errorsTypes.userDoesNotExistError.code;
    }
}

module.exports = OrganizationError;
