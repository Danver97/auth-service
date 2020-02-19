const express = require('express');
const apiutils = require('../utils');
const presentation = require('../presentation');
const router = express.Router();

let userMgr;
let queryMgr;

const checkParam = apiutils.checkParam;

router.use(checkParam('userId'));

router.get('/users/:userId', async (req, res) => {
    const userId = req.params.userId;
    let user;
    try {
        user = await queryMgr.getFullUser(userId);
    } catch (error) {
        apiutils.serverError(res, error.msg);
        return;
    }
    res.json(presentation.userJSON(user));
});

router.get('/users/:userId/organizations', async (req, res) => {
    const userId = req.params.userId;
    let orgs;
    try {
        orgs = await queryMgr.getUserOrganizations(userId);
    } catch (error) {
        apiutils.serverError(res, error.msg);
        return;
    }
    res.json(orgs.map(o => presentation.orgJSON(o)));
});

router.get('/users/:userId/roles', async (req, res) => {
    const userId = req.params.userId;
    let rolesMap;
    try {
        rolesMap = await queryMgr.getUserOrganizations(userId);
    } catch (error) {
        apiutils.serverError(res, error.msg);
        return;
    }
    Object.keys(rolesMap).forEach(k => {
        rolesMap[k] = rolesMap[k].map(r => presentation.roleJSON(r));
    });
    res.json(rolesMap);
});

function exportFunc(userManager, queryManager) {
    userMgr = userManager;
    queryMgr = queryManager;

    return router;
}

module.exports = exportFunc;
