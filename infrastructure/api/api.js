const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const apiutils = require('./utils');
const presentation = require('./presentation');
const logger = require('./api_logger');
const Validator = require('./tokenValidator');
const ENV = require('../../lib/env');

const QueryError = require('../query/query.error');

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
    const token = req.body.id_token;
    let ticket;
    try {
        ticket = await auth2.verifyGoogleIdToken(token);
    } catch (err) {
        apiutils.clientError(res, 'token not valid', 401);
        return;
    }
    const payload = ticket.getPayload();
    console.log(payload);
    // check if user is present
    // if not creates it
    // generate new user access token for our platform
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
        apiutils.serverError(res, error.msg);
        return;
    }
    res.json(presentation.orgJSON(org));
});

app.use('/organizations/:orgId', checkParam('orgId'), addParam('orgId'));

app.get('/organizations/:orgId', async (req, res) => {
    const orgId = req.params.orgId;
    let org;
    try {
        org = await queryMgr.getOrganization(orgId);
    } catch (error) {
        if (error instanceof QueryError) {
            switch (error.code) {
                case QueryError.notFoundCode:
                    apiutils.clientError(res, 'Organization not found', 404);
                    return;
            }
        }
        apiutils.clientError(res, error.msg);
        return;
    }
    res.json(presentation.orgJSON(org));
});


function exportFunc(orgManager, userManager, queryManager, logLevel) {
    orgMgr = orgManager;
    userMgr = userManager;
    queryMgr = queryManager;
    logger.setLogLevel(logLevel);    

    app.use('/organizations/:orgId/roles'/* , addParam('orgId') */, orgRolesAPIFunc(orgManager, queryManager));
    app.use('/organizations/:orgId/users'/* , addParam('orgId') */, orgUsersAPIFunc(orgManager, queryManager));
    app.use('/users/:userId', usersAPIFunc(userManager, queryManager));
    return app;
}

module.exports = exportFunc;
