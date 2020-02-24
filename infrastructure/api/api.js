const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const apiutils = require('./utils');
const presentation = require('./presentation');
const logger = require('./api_logger');
const Validator = require('../../lib/tokenValidator').Validator;
const ENV = require('../../lib/env');

const QueryError = require('../query/query.error');
const OrganizationError = require('../../domain/errors/organization.error');
const RepositoryError = require('../repository/repo.error');
const RoleError = require('../../domain/errors/role.error');
const PermissionError = require('../../domain/errors/permission.error');
const OrganizationManagerError = require('../../domain/errors/organizationManager.error');

// Routes
const orgRolesAPIFunc = require('./routes/organization_roles.route');
const orgUsersAPIFunc = require('./routes/organization_users.route');
const usersAPIFunc = require('./routes/users.route');

const app = express();
const auth2 = new Validator(ENV.CLIENT_ID);
const checkParam = apiutils.checkParam;
const addParam = apiutils.addParam;

let orgMgr;
let userMgr;
let queryMgr;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.use((req, res, next) => {
    logger.log('log', `${req.method}\t${req.url}`);
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../../index.html'));
});

app.get('/service', (req, res) => {
    res.json({ service: 'auth-service' });
});

app.post('/login', async (req, res) => {
    const id_token = req.body.id_token;
    let ticket;
    try {
        ticket = await auth2.verifyGoogleIdToken(id_token);
    } catch (err) {
        console.log(err);
        apiutils.clientError(res, 'token not valid', 401);
        return;
    }
    const payload = ticket.getPayload();
    const userInfo = {
        accountId: payload.sub,
        accountType: 'Google',
        firstname: payload.given_name,
        lastname: payload.family_name,
        email: payload.email,
    };
    const user = await userMgr.login(userInfo);
    const jwtPayload = user.toJSON();
    const jwtToken = jwt.sign(jwtPayload, 'privatekey', {
        expiresIn: '1h',
        subject: user.uniqueId,
    });
    console.log(jwtToken);
    res.json({ token: jwtToken });
});

app.post('/organizations', async (req, res) => {
    const name = req.body.name;
    if (!name) {
        apiutils.clientError(res, 'Missing name property from body');
        return;
    }

    let org;
    try {
        org = await orgMgr.organizationCreated(name);
    } catch (error) {
        next(error);
        return;
    }
    res.json(presentation.orgJSON(org));
});

app.use('/organizations/:orgId', checkParam('orgId'), addParam('orgId'));

app.get('/organizations/:orgId', async (req, res, next) => {
    const orgId = req.params.orgId;
    // let org = await queryMgr.getOrganization(orgId);
    let org;
    try {
        org = await queryMgr.getOrganization(orgId);
    } catch (error) {
        next(error);
        return;
    }
    res.json(presentation.orgJSON(org));
});

function errorHandling(err, req, res, next) {    
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

function exportFunc(orgManager, userManager, queryManager, logLevel) {
    orgMgr = orgManager;
    userMgr = userManager;
    queryMgr = queryManager;
    logger.setLogLevel(logLevel);    

    app.use('/organizations/:orgId/roles', orgRolesAPIFunc(orgManager, queryManager));
    app.use('/organizations/:orgId/users', orgUsersAPIFunc(orgManager, queryManager));
    app.use('/users/:userId', usersAPIFunc(userManager, queryManager));

    app.use(errorHandling);

    return app;
}

module.exports = exportFunc;
