const express = require('express');
const apiutils = require('../utils');
const presentation = require('../presentation');
const Role = require('../../../domain/models/role.class');
const Permission = require('../../../domain/models/permission.class');
const RoleError = require('../../../domain/errors/role.error');
const PermissionError = require('../../../domain/errors/permission.error');
const OrganizationError = require('../../../domain/errors/organization.error');
const RepositoryError = require('../../repository/repo.error');
const QueryError = require('../../query/query.error');
const OrganizationManagerError = require('../../../domain/errors/organizationManager.error');
const router = express.Router();

let orgMgr;
let queryMgr;

const checkParam = apiutils.checkParam;

// Base path /organizations/:orgId/roles

router.get('/', async (req, res) => {
    const orgId = req.orgId;

    let roles;
    try {
        roles = await queryMgr.getOrganizationRoles(orgId);
    } catch (error) {
        if (error instanceof QueryError) {
            switch (error.code) {
                case QueryError.notFoundCode:
                    apiutils.clientError(res, 'Organization not found', 404);
                    return;
            }
        }
        apiutils.serverError(res, error.msg);
        return;
    }
    res.json(roles.map(r => presentation.roleJSON(r)));
});

router.post('/', async (req, res) => {
    const orgId = req.orgId;
    if (!req.body.name || typeof req.body.name !== 'string') {
        apiutils.clientError(res, 'name property in body must be a string');
        return;
    }
    if (!Array.isArray(req.body.permissions) || typeof req.body.permissions !== 'object') {
        apiutils.clientError(res, 'permissions property in body must be an array of object');
        return;
    }
    
    let role;
    try {
        const permissions = req.body.permissions.map(p => Permission.fromObject(p));
        role = new Role(req.body.name, permissions);
        await orgMgr.roleAdded(orgId, role);
    } catch (error) {
        if (error instanceof PermissionError || error instanceof RoleError) {
            apiutils.clientError(res, error.msg);
            return;
        }
        if (error instanceof RepositoryError) {
            switch (error.code) {
                case RepositoryError.streamNotFoundErrorCode:
                    apiutils.clientError(res, `Organization with id ${orgId} not found`, 404);
                    return;
            }
        }
        apiutils.serverError(res, error.msg);
        return;
    }
    return res.json(presentation.roleJSON(role, orgId));
});

router.use('/:roleId', checkParam('roleId'));

router.get('/:roleId', async (req, res) => {
    const orgId = req.orgId;
    const roleId = req.params.roleId;

    let role;
    try {
        role = await queryMgr.getRole(orgId, roleId);
    } catch (error) {
        if (error instanceof QueryError) {
            switch (error.code) {
                case QueryError.notFoundCode:
                    apiutils.clientError(res, 'Role not found', 404);
                    return;
            }
        }
        apiutils.serverError(res, error.msg);
        return;
    }
    res.json(presentation.roleJSON(role));
});

router.put('/:roleId', async (req, res) => {
    const orgId = req.orgId;
    const roleId = req.params.roleId;
    const roleUpdated = req.body;

    try {
        if (roleUpdated.permissions)
            roleUpdated.permissions = roleUpdated.permissions.map(p => Permission.fromObject(p));
        await orgMgr.roleChanged(orgId, roleId, roleUpdated);
    } catch (error) {
        if (error instanceof PermissionError) {
            switch (error.code) {
                case PermissionError.paramErrorCode:
                    apiutils.clientError(res, 'Permissions are not well defined', 400);
                    return;
            }
        }
        if (error instanceof OrganizationError) {
            switch (error.code) {
                case OrganizationError.roleDoesNotExistErrorCode:
                    apiutils.clientError(res, 'Role not found', 404);
                    return;
            }
        }
        if (error instanceof RepositoryError) {
            switch (error.code) {
                case RepositoryError.streamNotFoundErrorCode:
                    apiutils.clientError(res, `Organization with id ${orgId} not found`, 404);
                    return;
            }
        }
        if (error instanceof OrganizationManagerError) {
            switch (error.code) {
                case OrganizationManagerError.noRoleChangesErrorCode:
                    apiutils.clientError(res, 'No changes to apply to role', 400);
                    return;
            }
        }
        apiutils.serverError(res, error.msg);
        return;
    }
    apiutils.emptyResponse(res);
});

router.delete('/:roleId', async (req, res) => {
    const orgId = req.orgId;
    const roleId = req.params.roleId;

    try {
        await orgMgr.roleRemoved(orgId, roleId);
    } catch (error) {
        if (error instanceof RepositoryError) {
            switch (error.code) {
                case RepositoryError.streamNotFoundErrorCode:
                    apiutils.clientError(res, 'Organization not found', 404);
                    return;
            }
        }
        if (error instanceof OrganizationError) {
            switch (error.code) {
                case OrganizationError.roleDoesNotExistErrorCode:
                    apiutils.clientError(res, 'Role not found', 404);
                    return;
            }
        }
        apiutils.serverError(res, error.msg);
        return;
    }
    apiutils.emptyResponse(res);
});

function exportFunc(orgManager, queryManager) {
    orgMgr = orgManager;
    queryMgr = queryManager;

    return router;
}

module.exports = exportFunc;
