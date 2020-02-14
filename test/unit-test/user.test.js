const assert = require('assert');
const User = require('../../domain/models/user.class');
const Gender = require('../../domain/models/gender.class');
const Phone = require('../../domain/models/phone.class');
const UserError = require('../../domain/errors/user.error');

describe('User class unit test', function () {
    const options = {
        accountId: 14546434341331,
        accountType: 'Google',
        firstname: 'Christian',
        lastname: 'Paesante',
        email: 'chri.pae@gmail.com',
    };

    it('check constructor works properly', function () {
        assert.throws(() => new User(), UserError);
        assert.throws(() => new User({}), UserError);
        assert.throws(() => new User({ accountId: options.accountId }), UserError);
        assert.throws(() => new User({ accountId: options.accountId, accountType: options.accountType }), UserError);
        assert.throws(() => new User({
            accountId: options.accountId,
            accountType: options.accountType,
            firstname: options.firstname,
        }), UserError);
        assert.throws(() => new User({
            accountId: options.accountId,
            accountType: options.accountType,
            firstname: options.firstname,
            lastname: options.lastname,
        }), UserError);

        const user = new User(options);
        assert.strictEqual(user.accountId, options.accountId);
        assert.strictEqual(user.accountType, options.accountType);
        assert.strictEqual(user.firstname, options.firstname);
        assert.strictEqual(user.lastname, options.lastname);
        assert.strictEqual(user.email, options.email);
    });

    it('check get uniqueId', function () {
        const user = new User(options);
        assert.strictEqual(user.uniqueId, `${options.accountId}:${options.accountType}`);
    });

    it('check get name', function () {
        const user = new User(options);
        assert.strictEqual(user.fullname, `${options.firstname} ${options.lastname}`);
    });

    it('check get mail', function () {
        const user = new User(options);
        assert.strictEqual(user.mail, options.email);
    });

    it('check get/set dob', function () {
        const user = new User(options);
        const dob = new Date(1997, 9, 2); // 1997/10/02
        user.dob = dob;
        assert.strictEqual(user.dob.getTime(), dob.getTime());
        user.dob = dob.toLocaleDateString();
        assert.deepStrictEqual(user.dob.getTime(), dob.getTime());
    });

    it('check get/set gender', function () {
        const user = new User(options);
        const g = Gender.MALE;
        user.gender = g;
        assert.deepStrictEqual(user.gender, g);
        user.gender = 'male';
        assert.deepStrictEqual(user.gender, g);
    });

    it('check get/set phone', function () {
        const user = new User(options);
        const phone = new Phone('+393451392795');
        user.phone = phone;
        assert.deepStrictEqual(user.phone, phone);
        user.phone = phone.toString();
        assert.deepStrictEqual(user.phone, phone);
    });

    it('check fromObject', function () {
        const user = new User(options);
        user.dob = new Date(1997, 9, 2);
        user.gender = Gender.MALE;
        user.phone = new Phone('+393451392795');
        const user2 = User.fromObject(user.toJSON());
        assert.deepStrictEqual(user2, user);
    })

    it('check toJSON', function () {
        const user = new User(options);
        const dob = new Date(1997, 9, 2); // 1997/10/02
        const g = Gender.MALE;
        const phone = new Phone('+393451392795');
        user.dob = dob;
        user.gender = g;
        user.phone = phone;

        const expected = {
            uniqueId: `${options.accountId}:${options.accountType}`,
            accountId: options.accountId,
            accountType: options.accountType,
            firstname: options.firstname,
            lastname: options.lastname,
            fullname: `${options.firstname} ${options.lastname}`,
            email: options.email,
            dob,
            gender: g,
            phone,
        };
        assert.deepStrictEqual(user.toJSON(), expected);
    });
});