const { OAuth2Client } = require('google-auth-library');
const ExtendableError = require('./extendable_error.error');

const errorsTypes = {
    paramError: {
        code: 0,
        name: 'paramError',
    },
    invalidTokenError: {
        code: 1,
        name: 'invalidTokenError',
    },
};

class ValidatorError extends ExtendableError {
    
    static get errors() {
        return errorsTypes;
    }

    static paramError(msg) {
        return new ValidatorError(msg, ValidatorError.paramErrorCode);
    }

    static invalidTokenError(msg) {
        return new ValidatorError(msg, ValidatorError.invalidTokenErrorCode);
    }

    static get paramErrorCode() {
        return errorsTypes.paramError.code;
    }

    static get invalidTokenErrorCode() {
        return errorsTypes.invalidTokenError.code;
    }
}


class Validator {
    constructor(CLIENT_ID) {
        this.CLIENT_ID = CLIENT_ID;
        this.client = new OAuth2Client(CLIENT_ID);
    }

    async verifyGoogleIdToken(idToken) {
        if (!idToken)
            throw ValidatorError.paramError('Missing idToken parameter');
        let ticket;
        try {
            ticket = await this.client.verifyIdToken({
                idToken,
                audience: this.CLIENT_ID,
            });
        } catch (error) {
            throw ValidatorError.invalidTokenError('idToken is invalid');
        }
        return ticket;
    }
}

module.exports = { Validator, ValidatorError };
