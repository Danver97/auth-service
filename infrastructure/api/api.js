const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const JWTSecure = require('@danver97/jwt-secure')('test');

const apiutils = require('./utils');
const presentation = require('./presentation');
const logger = require('./api_logger');
const errHandler = require('./api_error_handler');
const Validator = require('../../lib/tokenValidator').Validator;
const ENV = require('../../lib/env');
const permissionDefs = require('../../domain/permissions');

const ApiError = require('./api.error');

// Routes
const orgRolesAPIFunc = require('./routes/organization_roles.route');
const orgUsersAPIFunc = require('./routes/organization_users.route');
const usersAPIFunc = require('./routes/users.route');

const app = express();
const jwts = new JWTSecure({ rsabit: 2048, algo: 'RS512', rotationInterval: 30, keyExpirationInterval: 30 });
const auth2 = new Validator(ENV.CLIENT_ID);
const checkParam = apiutils.checkParam;
const addParam = apiutils.addParam;

let orgMgr;
let userMgr;
let queryMgr;

let permCheck;

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
        next(err);
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
    const expInOneHour = new Date((new Date()).setHours((new Date()).getHours() + 1));
    Object.assign(jwtPayload, {
        exp: expInOneHour.toISOString(),
        sub: user.uniqueId,
    });
    const jwtToken = await jwts.sign(jwtPayload);
    console.log(jwtToken);
    res.json({ token: jwtToken });
});


function exportFunc(options = {}) {
    const { orgManager, userManager, queryManager, permChecker, logLevel } = options;
    orgMgr = orgManager;
    userMgr = userManager;
    queryMgr = queryManager;
    permCheck = permChecker;
    logger.setLogLevel(logLevel);

    app.use('/organizations', permCheck.verifyToken);

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

    app.get('/organizations/:orgId', permCheck.checkPermission({ permissionDefs: [permissionDefs.organizationManagement], params: ['orgId'] }),
        async (req, res, next) => {
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

    app.use('/organizations/:orgId/roles', orgRolesAPIFunc(orgManager, queryManager, permCheck));
    app.use('/organizations/:orgId/users', orgUsersAPIFunc(orgManager, queryManager, permCheck));
    app.use('/users/:userId', usersAPIFunc(userManager, queryManager, permCheck));

    app.use(errHandler);

    return app;
}

module.exports = exportFunc;
