const PhoneError = require('../errors/phone.error');

class Phone {
    constructor(number) {
        if (typeof number !== 'string')
            throw PhoneError.paramError(`number must be a string`);
        if (!(/^(?:\+39)?[0-9]{9,10}$/.test(number))) // TODO: internationalize
            throw PhoneError.paramError(`The number is not formatted in the right way`);
        this.number = number;
    }

    toJSON() {
        return this.number;
    }

    toString() {
        return this.number;
    }
}

module.exports = Phone;
