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
};
