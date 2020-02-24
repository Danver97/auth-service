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
    assignedRoleDoesNotExistsError: {
        code: 11,
        name: 'assignedRoleDoesNotExistsError',
    },
    removedRoleDoesNotExistsError: {
        code: 12,
        name: 'removedRoleDoesNotExistsError',
    },
    roleDoesNotExistError: {
        code: 13,
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
    organizationDeletedError: {
        code: 100,
        name: 'organizationDeletedError',
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

    static assignedRoleDoesNotExistsError(msg) {
        return new OrganizationError(msg, OrganizationError.assignedRoleDoesNotExistsErrorCode);
    }

    static removedRoleDoesNotExistsError(msg) {
        return new OrganizationError(msg, OrganizationError.removedRoleDoesNotExistsErrorCode);
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
    
    static organizationDeletedError(msg) {
        return new OrganizationError(msg, OrganizationError.organizationDeletedErrorCode);
    }

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }
    
    static get roleAlreadyExistsErrorCode() {
        return errorsTypes.roleAlreadyExistsError.code;
    }
    
    static get assignedRoleDoesNotExistsErrorCode() {
        return errorsTypes.assignedRoleDoesNotExistsError.code;
    }
    
    static get removedRoleDoesNotExistsErrorCode() {
        return errorsTypes.removedRoleDoesNotExistsError.code;
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

    static get organizationDeletedErrorCode() {
        return errorsTypes.organizationDeletedError.code;
    }
}

module.exports = OrganizationError;
