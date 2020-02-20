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

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }

    static get noRoleChangesErrorCode() {
        return errorsTypes.noRoleChangesError.code;
    }
}

module.exports = OrganizationManagerError;
