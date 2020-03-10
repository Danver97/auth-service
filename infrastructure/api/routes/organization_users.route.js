const express = require('express');
const apiutils = require('../utils');
const presentation = require('../presentation');
const router = express.Router();

let orgMgr;
let queryMgr;

const checkParam = apiutils.checkParam;

router.get('/', async (req, res, next) => {
    const orgId = req.orgId;

    let users;
    try {
        users = await queryMgr.getOrganizationUsers(orgId);
    } catch (error) {
        next(error);
        return;
    }
    res.json(users.map(u => presentation.userJSON(u)));
});

router.post('/', async (req, res, next) => {
    const orgId = req.orgId;
    const userId = req.body.userId;
    if (!userId || typeof userId !== 'string') {
        apiutils.clientError(res, 'Body parameter userId must be a string');
        return;
    }

    try {
        await orgMgr.userAdded(orgId, userId);
    } catch (error) {
        next(error);
        return;
    }
    apiutils.emptyResponse(res);
});

router.use('/:userId', checkParam('userId'));

router.delete('/:userId', async (req, res, next) => {
    const orgId = req.orgId;
    const userId = req.params.userId;

    try {
        await orgMgr.userRemoved(orgId, userId);
    } catch (error) {
        next(error);
        return;
    }
    apiutils.emptyResponse(res);
});

router.get('/:userId/roles', async (req, res, next) => {
    const orgId = req.orgId;
    const userId = req.params.userId;

    let roles;
    try {
        roles = await queryMgr.getOrganizationUserRoles(orgId, userId);
    } catch (error) {
        next(error);
        return;
    }
    res.json(roles.map(r => presentation.roleInstanceJSON(r)));
});

router.post('/:userId/roles', async (req, res, next) => {
    const orgId = req.orgId;
    const userId = req.params.userId;
    const roles = req.body.roles;
    if (!roles || !Array.isArray(roles) || (roles.length > 0 && typeof roles[0] !== 'object')) {
        apiutils.clientError(res, 'Body parameter \'roles\' must be an array of objects');
        return;
    }
    for(let r of roles) {
        if (!r.roleDefId) {
            apiutils.clientError(res, 'Each elements of \'roles\' must include the property \'roleDefId\' as string');
            return;
        }
    }
    
    try {
        await orgMgr.rolesAssignedToUser(orgId, userId, roles);
    } catch (error) {
        next(error);
        return;
    }
    apiutils.emptyResponse(res);
});

router.delete('/:userId/roles/:roleId', checkParam('roleId'), async (req, res, next) => {
    const orgId = req.orgId;
    const userId = req.params.userId;
    const roleId = req.params.roleId;

    try {
        await orgMgr.rolesRemovedFromUser(orgId, userId, [roleId]);
    } catch (error) {
        next(error);
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
