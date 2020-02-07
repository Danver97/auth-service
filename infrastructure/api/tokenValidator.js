const { OAuth2Client } = require('google-auth-library');

class Validator {
    constructor(CLIENT_ID) {
        this.CLIENT_ID = CLIENT_ID;
        this.client = new OAuth2Client(CLIENT_ID);
    }

    verifyGoogleIdToken(idToken) {
        return this.client.verifyIdToken({
            idToken,
            audience: this.CLIENT_ID,
        });
    }
}

module.exports = Validator;
