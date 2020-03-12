const JWTSecure = require('@danver97/jwt-secure')('test');
const ApiError = require('./api.error');
const PermissionDefinition = require('../../domain/models/permissionDef.class');

const jwts = new JWTSecure({ rsabit: 2048, algo: 'RS512', rotationInterval: 30, keyExpirationInterval: 30 });

function init() {
    return jwts.init();
}

async function signJWT(payload) {
    const expInOneHour = new Date();
    expInOneHour.setHours(expInOneHour.getHours() + 1);
    payload = Object.assign({
        exp: payload.exp || expInOneHour.getTime(), // expInOneHour.toISOString(),
    }, payload);
    const token = await jwts.sign(payload);
    return token;
}

async function verifyToken(req, res, next) {
    if (req.jwtPayload) {
        // console.log('token request already verified and decoded.');
        next();
        return;
    }
    const value = req.header('Authentication');
    const tokenRegExp = /^Bearer (.+)$/;
    let token;
    if (tokenRegExp.test(value))
        token = tokenRegExp.exec(value)[1];
    if (!token) {
        const err = ApiError.noTokenError('Missing jwt token');
        next(err);
        return;
    }
    let jwtPayload;
    try {
        jwtPayload = await jwts.verify(token);
    } catch (err) {
        err = ApiError.invalidTokenError('Token is invalid');
        next(err);
        return;
    }
    req.token = token;
    req.jwtPayload = jwtPayload;
    if (!jwtPayload.exp || (new Date(jwtPayload.exp)).getTime() < Date.now()) {
        const err = ApiError.tokenExpiredError('Token has expired');
        next(err);
        return;
    }
    
    next();
}

/**
 * @param {object} options
 * @param {PermissionDefinition} options.permissionDefs
 * @param {object} options.params
 */
function checkPermission(options) {
    if (!options)
        throw new Error(`Missing parameters: options`);
    const { permissionDefs = [], params = [] } = options;
    if (!Array.isArray(permissionDefs) || (permissionDefs.length > 0 && !(permissionDefs[0] instanceof PermissionDefinition)))
        throw new Error(`permissionDefs must be an array of PermissionDefinition`);

    return [verifyToken, function (req, res, next) {
        const orgId = req.params.orgId || req.orgId;
        if (!orgId) {
            console.warn('Can\'t get orgId from request. Can\'t check for request authorization. The request will be executed without limitations');
            next();
            return;
        }
        
        if (!req.jwtPermissions) {
            req.jwtPermissions = new Map();
            req.jwtPayload.roles = req.jwtPayload.roles || {}
            Object.keys(req.jwtPayload.roles).map(k => req.jwtPayload.roles[k].permissions).flat().forEach(p => {
                req.jwtPermissions.set(p.name, p);
            });
        }
        
        let hasPermission = false;
        for (let permDef of permissionDefs) {
            if (!req.jwtPermissions.has(permDef.name))
                continue;
            const perm = req.jwtPermissions.get(permDef.name);
            let hasParams = true;
            for (let p of params) {
                const pVal = req.params[p] || req[p];
                if (perm.parameters[p] !== pVal) {
                    hasParams = false;
                    break;
                }
            }
            hasPermission = hasPermission || hasParams;
        }

        if (!hasPermission) {
            const err = ApiError.notAuthorizedError('User doesn\'t have the role or the permission');
            next(err);
            return;
        }
        next();
    }];
}

module.exports = {
    init,
    signJWT,
    verifyToken,
    checkPermission,
};
