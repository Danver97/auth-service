function emptyResponse(res, code) {
    res.status(code || 200);
    res.end();
}

function clientError(res, message, code) {
    res.status(code || 400);
    res.json({ error: message });
}

function serverError(res, message, code) {
    res.status(code || 500);
    res.json({ error: message });
}

function checkParam(paramName, appendParam = false) {
    return function (req, res, next) {
        const param = req.params[paramName];
        if (!param) {
            clientError(res, `Missing ${paramName} url parameter`);
            return;
        }
        if (appendParam) 
            req[paramName] = param;
        next();
    };
}

function addParam(paramName) {
    return function (req, res, next) {
        const param = req.params[paramName];
        req[paramName] = param;
        next();
    };
}

function verifyGoogleIdToken(client, idToken, audience) {
    return client.verifyIdToken({
        idToken,
        audience,
    });
}

module.exports = {
    emptyResponse,
    clientError,
    serverError,
    checkParam,
    addParam,
};
