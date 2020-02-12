const GenderError = require('../errors/gender.error');

const supported = {
    male: true,
    female: true,
    other: true,
};

class Gender {
    constructor (g) {
        if (!supported[g])
            throw GenderError.paramError('gender type not supported')
        this.g = g;
    }
    
    static get MALE() {
        return new Gender('male');
    };
    static get FEMALE() {
        return new Gender('female');
    };
    static get OTHER() {
        return new Gender('other');
    };

    toString() {
        return this.g;
    }

    toJSON() {
        return this.g;
    }
}

module.exports = Gender;
