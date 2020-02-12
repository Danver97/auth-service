const UserError = require('../errors/user.error');
const Gender = require('./gender.class');
const Phone = require('./phone.class');

class User {
    constructor(options) {
        this.accountId = options.accountId;
        this.accountType = options.accountType;
        this.firstname = options.firstname;
        this.lastname = options.lastname;
        this.email = options.email;
    }

    _isValidDateString(dateStr) {
        const dobRegex = /^((?:19|20)\d{2})(\/|-)(\d?\d)\2(\d?\d)$/;
        const match = dobRegex.exec(dateStr);
        if (!match)
            return false;
        const year = parseInt(match[1]);
        const month = parseInt(match[3]);
        if (month < 1 || month > 12)
            return false;
        const day = parseInt(match[4]);
        if (day < 1 || day > (new Date(year, month, 0)).getDate())
            return false;
        return true;
    }

    set dob(date) {
        if (!(typeof date === 'string' && this._isValidDateString(date)) && !(date instanceof Date))
            throw UserError.paramError('dob must be a string or a Date')
        if (typeof date === 'string' && this._isValidDateString(date))
            this._dob = new Date(date);
        if (date instanceof Date)
            this._dob = date;
    }

    set gender(g) {
        if (!(typeof g === 'string') && !(g instanceof Gender))
            throw UserError.paramError('g must be a string or a Gender instance');
        if (typeof g === 'string')
            this._gender = new Gender(g);
        if (g instanceof Gender)
            this._gender = g;
    }

    set phone(phone) {
        if (!(typeof phone === 'string') && !(phone instanceof Phone))
            throw UserError.paramError('phone must be a string or a Phone instance');
        if (typeof phone === 'string')
            this._phone = new Phone(phone);
        if (phone instanceof Phone)
            this._phone = phone;
    }

    get uniqueId() {
        return `${this.accountId}:${this.accountType}`;
    }

    get fullname() {
        return `${this.firstname} ${this.lastname}`;
    }

    get mail() {
        return this.email;
    }

    get dob() {
        return this._dob;
    }
    
    get gender() {
        return this._gender;
    }

    get phone() {
        return this._phone;
    }

    toJSON() {
        return {
            uniqueId: this.uniqueId,
            accountId: this.accountId,
            accountType: this.accountType,
            firstname: this.firstname,
            lastname: this.lastname,
            fullname: this.fullname,
            email: this.email,
            dob: this.dob,
            gender: this.gender,
            phone: this.phone,
        }
    }
}

module.exports = User;
