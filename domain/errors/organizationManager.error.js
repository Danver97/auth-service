const ExtendableError = require('../../lib/extendable_error.error');

const errorsTypes = {
    paramError: {
        code: 0,
        name: 'paramError',
    },
    noRoleChangesError: {
        code: 10,
        name: 'noRoleChangesError',
    },
    roleToAssignDoesNotExistsError: {
        code: 11,
        name: 'roleToAssignDoesNotExistsError',
    },
};

class OrganizationManagerError extends ExtendableError {
    
    static get errors() {
        return errorsTypes;
    }

    static paramError(msg) {
        return new OrganizationManagerError(msg, OrganizationManagerError.paramErrorCode);
    }

    static noRoleChangesError(msg) {
        return new OrganizationManagerError(msg, OrganizationManagerError.noRoleChangesErrorCode);
    }

    static roleToAssignDoesNotExistsError(msg) {
        return new OrganizationManagerError(msg, OrganizationManagerError.roleToAssignDoesNotExistsErrorCode);
    }

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }

    static get noRoleChangesErrorCode() {
        return errorsTypes.noRoleChangesError.code;
    }

    static get roleToAssignDoesNotExistsErrorCode() {
        return errorsTypes.roleToAssignDoesNotExistsError.code;
    }
}

module.exports = OrganizationManagerError;
