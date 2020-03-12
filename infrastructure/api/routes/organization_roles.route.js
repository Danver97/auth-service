const express = require('express');
const apiutils = require('../utils');
const presentation = require('../presentation');
const PermissionDefinition = require('../../../domain/models/permissionDef.class');
const RoleDefinition = require('../../../domain/models/roleDef.class');
const permissionDefs = require('../../../domain/permissions');
const router = express.Router();

let orgMgr;
let queryMgr;

let permCheck;

const checkParam = apiutils.checkParam;

function exportFunc(orgManager, queryManager, permChecker) {
    orgMgr = orgManager;
    queryMgr = queryManager;
    permCheck = permChecker;


    // Base path /organizations/:orgId/roles
    
    router.get('/', permCheck.checkPermission({ permissionDefs: [permissionDefs.rolesList], params: ['orgId'] }),
    async (req, res, next) => {
        const orgId = req.orgId;
    
        let roles;
        try {
            roles = await queryMgr.getOrganizationRoles(orgId);
        } catch (error) {
            next(error);
            return;
        }
        res.json(roles.map(r => presentation.roleDefJSON(r)));
    });
    
    router.post('/', permCheck.checkPermission({ permissionDefs: [permissionDefs.rolesManagement], params: ['orgId'] }),
    async (req, res, next) => {
        const orgId = req.orgId;
        if (!req.body.name || typeof req.body.name !== 'string') {
            apiutils.clientError(res, 'name property in body must be a string');
            return;
        }
        if (!Array.isArray(req.body.permissions) || typeof req.body.permissions !== 'object') {
            apiutils.clientError(res, 'permissions property in body must be an array of object');
            return;
        }
        
        let roleDef;
        try {
            req.body.orgId = orgId;
            req.body.permissions = req.body.permissions.map(p => PermissionDefinition.fromObject(p));
            roleDef = new RoleDefinition(req.body);
            await orgMgr.roleDefinitionAdded(orgId, roleDef);
        } catch (error) {
            next(error);
            return;
        }
        return res.json(presentation.roleDefJSON(roleDef, orgId));
    });
    
    router.use('/:roleId', checkParam('roleId'));
    
    router.get('/:roleId', permCheck.checkPermission({ permissionDefs: [permissionDefs.rolesList], params: ['orgId'] }),
    async (req, res, next) => {
        const orgId = req.orgId;
        const roleId = req.params.roleId;
    
        let role;
        try {
            role = await queryMgr.getRoleDefinition(orgId, roleId);
        } catch (error) {
            next(error);
            return;
        }
        res.json(presentation.roleDefJSON(role));
    });
    
    router.put('/:roleId', permCheck.checkPermission({ permissionDefs: [permissionDefs.rolesManagement], params: ['orgId'] }),
    async (req, res, next) => {
        const orgId = req.orgId;
        const roleId = req.params.roleId;
        const roleUpdated = req.body;
    
        try {
            if (roleUpdated.permissions)
                roleUpdated.permissions = roleUpdated.permissions.map(p => PermissionDefinition.fromObject(p));
            await orgMgr.roleDefinitionChanged(orgId, roleId, roleUpdated);
        } catch (error) {
            next(error);
            return;
        }
        apiutils.emptyResponse(res);
    });
    
    router.delete('/:roleId', permCheck.checkPermission({ permissionDefs: [permissionDefs.rolesManagement], params: ['orgId'] }),
    async (req, res, next) => {
        const orgId = req.orgId;
        const roleId = req.params.roleId;
    
        try {
            await orgMgr.roleDefinitionRemoved(orgId, roleId);
        } catch (error) {
            next(error);
            return;
        }
        apiutils.emptyResponse(res);
    });

    return router;
}

module.exports = exportFunc;
