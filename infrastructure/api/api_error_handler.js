const apiutils = require('./utils');

const QueryError = require('../query/query.error');
const OrganizationError = require('../../domain/errors/organization.error');
const RepositoryError = require('../repository/repo.error');
const RoleError = require('../../domain/errors/role.error');
const PermissionError = require('../../domain/errors/permission.error');
const OrganizationManagerError = require('../../domain/errors/organizationManager.error');

function errorHandler(err, req, res, next) {    
    if (err instanceof QueryError) {
        switch (err.code) {
            case QueryError.roleNotFoundErrorCode:
                apiutils.clientError(res, 'Role not found', 404);
                return;
            case QueryError.organizationNotFoundErrorCode:
                apiutils.clientError(res, 'Organization not found', 404);
                return;
            case QueryError.userNotFoundErrorCode:
                apiutils.clientError(res, 'User not found', 404);
                return;
        }
    }

    if (err instanceof PermissionError) {
        switch (err.code) {
            case PermissionError.paramErrorCode:
                apiutils.clientError(res, 'Permissions are not well defined', 400);
                return;
        }
    }

    if (err instanceof OrganizationError) {
        switch (err.code) {
            case OrganizationError.roleDoesNotExistErrorCode:
                apiutils.clientError(res, 'Role does not exist in the organization', 404);
                return;
            case OrganizationError.userDoesNotExistErrorCode:
                apiutils.clientError(res, 'User does not exist in the organization', 404);
                return;
            case OrganizationError.userAlreadyExistsErrorCode:
                apiutils.clientError(res, 'User already present in the organization', 400);
                return;
            case OrganizationError.assignedRoleDoesNotExistsErrorCode:
                apiutils.clientError(res, 'One of the roles specified does not exist in the organization', 404);
                return;
            case OrganizationError.removedRoleDoesNotExistsErrorCode:
                apiutils.clientError(res, 'Role does not exist in the organization', 404);
                return;
        }
    }

    if (err instanceof RepositoryError) {
        switch (err.code) {
            case RepositoryError.organizationStreamNotFoundErrorCode:
                apiutils.clientError(res, 'Organization not found', 404);
                return;
            case RepositoryError.userStreamNotFoundErrorCode:
                apiutils.clientError(res, 'User not found', 404);
                return;
        }
    }

    if (err instanceof OrganizationManagerError) {
        switch (err.code) {
            case OrganizationManagerError.noRoleChangesErrorCode:
                apiutils.clientError(res, 'No changes to apply to role', 400);
                return;
        }
    }
    apiutils.serverError(res, err.message);
    return;
}

module.exports = errorHandler;
