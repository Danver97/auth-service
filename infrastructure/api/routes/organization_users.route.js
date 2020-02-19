const express = require('express');
const apiutils = require('../utils');
const presentation = require('../presentation');
const OrganizationError = require('../../../domain/errors/organization.error');
const RepositoryError = require('../../repository/repo.error');
const QueryError = require('../../query/query.error');
const router = express.Router();

let orgMgr;
let queryMgr;

const checkParam = apiutils.checkParam;

router.get('/', async (req, res) => {
    const orgId = req.orgId;

    let users;
    try {
        users = await queryMgr.getOrganizationUsers(orgId);
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
    res.json(users.map(u => presentation.userJSON(u)));
});

router.post('/', async (req, res) => {
    const orgId = req.orgId;
    const userId = req.body.userId;
    if (!userId || typeof userId !== 'string') {
        apiutils.clientError(res, 'Body parameter userId must be a string');
        return;
    }

    try {
        await orgMgr.userAdded(orgId, userId);
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
                case OrganizationError.userAlreadyExistsErrorCode:
                    apiutils.clientError(res, 'User already present in the organization', 400);
                    return;
            }
        }
        apiutils.serverError(res, error.msg);
        return;
    }
    apiutils.emptyResponse(res);
});

router.use('/:userId', checkParam('userId'));

router.delete('/:userId', async (req, res) => {
    const orgId = req.orgId;
    const userId = req.params.userId;

    try {
        await orgMgr.userRemoved(orgId, userId);
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
                case OrganizationError.userDoesNotExistErrorCode:
                    apiutils.clientError(res, 'User does not exist in the organization', 404);
                    return;
            }
        }
        apiutils.serverError(res, error.msg);
        return;
    }
    apiutils.emptyResponse(res);
});

router.get('/:userId/roles', async (req, res) => {
    const orgId = req.orgId;
    const userId = req.params.userId;

    let roles;
    try {
        roles = await queryMgr.getOrganizationUserRoles(orgId, userId);
    } catch (error) {
        if (error instanceof QueryError) {
            switch (error.code) {
                case QueryError.notFoundCode:
                    apiutils.clientError(res, 'User not found', 404);
                    return;
            }
        }
        apiutils.serverError(res, error.msg);
        return;
    }
    res.json(roles.map(r => presentation.roleJSON(r)));
});

router.post('/:userId/roles', async (req, res) => {
    const orgId = req.orgId;
    const userId = req.params.userId;
    const rolesIds = req.body.rolesIds;
    if (!rolesIds || !Array.isArray(rolesIds) || (rolesIds.length > 0 && typeof rolesIds[0] !== 'string')) {
        apiutils.clientError(res, 'Body parameter rolesIds must be an array of strings');
        return;
    }
    
    try {
        await orgMgr.rolesAssignedToUser(orgId, userId, rolesIds);
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
                case OrganizationError.userDoesNotExistErrorCode:
                    apiutils.clientError(res, 'User does not exist in the organization', 404);
                    return;
                case OrganizationError.roleDoesNotExistErrorCode:
                    apiutils.clientError(res, 'One of the roles specified does not exist in the organization', 404);
                    return;
            }
        }
        apiutils.serverError(res, error.msg);
        return;
    }
    apiutils.emptyResponse(res);
});

router.delete('/:userId/roles/:roleId', checkParam('roleId'), async (req, res) => {
    const orgId = req.orgId;
    const userId = req.params.userId;
    const roleId = req.params.roleId;

    try {
        await orgMgr.rolesRemovedFromUser(orgId, userId, [roleId]);
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
                case OrganizationError.userDoesNotExistErrorCode:
                    apiutils.clientError(res, 'User does not exist in the organization', 404);
                    return;
                case OrganizationError.roleDoesNotExistErrorCode:
                    apiutils.clientError(res, 'One of the roles specified does not exist in the organization', 404);
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
