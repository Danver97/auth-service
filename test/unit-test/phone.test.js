const assert = require('assert');
const Phone = require('../../domain/models/phone.class');
const PhoneError = require('../../domain/errors/phone.error');

describe('Phone class unit test', function () {
    it('check constructor works', function () {
        assert.throws(() => new Phone(), PhoneError);
        assert.throws(() => new Phone({}), PhoneError);
        assert.throws(() => new Phone(3451392795), PhoneError);
        assert.throws(() => new Phone(''), PhoneError);
        assert.throws(() => new Phone('345'), PhoneError);
        
        let phone = new Phone('3451392795');
        assert.strictEqual(phone.number, '3451392795')
        phone = new Phone('+393451392795');
        assert.strictEqual(phone.number, '+393451392795')
    });

    it('check toString()', function () {
        assert.strictEqual(new Phone('+393451392795').toString(), '+393451392795');
    });

    it('check toJSON()', function () {
        assert.strictEqual(new Phone('+393451392795').toJSON(), '+393451392795');
    });
});