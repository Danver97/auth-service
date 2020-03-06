const JWTSecure = require('@danver97/jwt-secure')('test');
const ApiError = require('./api.error');

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
    console.log('verifyToken')
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
 * @param {Object} options
 * @param {string|string[]} [options.orgId] For testing purposes
 * @param {string|string[]} options.permissions
 * @param {string|string[]} options.roles
 */
function checkPermission(options = {}) {
    if (!options.permissions && !options.roles)
        throw new Error(`Missing parameters required at least one between options.permissions and options.roles`);
    let { permissions = [], roles = [], orgId } = options;
    if (!Array.isArray(permissions) && typeof permissions === 'string')
        permissions = [permissions];
    if (!Array.isArray(roles) && typeof roles === 'string')
        roles = [roles];

    return function (req, res, next) {
        orgId = req.params.orgId || req.orgId || orgId;
        if (!orgId) {
            console.warn('Can\'t get orgId from request. Can\'t check for request authorization. The request will be executed without limitations');
            next();
            return;
        }
        const jwtRolesArr = req.jwtPayload.roles ? req.jwtPayload.roles[orgId] || [] : [];
        req.jwtRoles = req.jwtRoles || new Set(jwtRolesArr.map(r => r.name));
        req.jwtPermissions = req.jwtPermissions || new Set(jwtRolesArr.map(r => r.permissions).flat().map(p => p.name));

        const hasRole = roles.reduce((acc, curr) => {
            acc = acc || req.jwtRoles.has(curr);
            return acc;
        }, false);
        const hasPermission = permissions.reduce((acc, curr) => {
            acc = acc || req.jwtPermissions.has(curr);
            return acc;
        }, false);

        if (!hasPermission && !hasRole) {
            const err = ApiError.notAuthorizedError('User doesn\'t have the role or the permission');
            next(err);
            return;
        }
        next();
    };
}

module.exports = {
    init,
    signJWT,
    verifyToken,
    checkPermission,
};
