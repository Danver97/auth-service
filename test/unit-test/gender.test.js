const assert = require('assert');
const Gender = require('../../domain/models/gender.class');
const GenderError = require('../../domain/errors/gender.error');

describe('Gender class unit test', function () {
    it('check constructor', function () {
        assert.throws(() => new Gender(), GenderError);
        assert.throws(() => new Gender({}), GenderError);
        assert.throws(() => new Gender(153354), GenderError);
        assert.throws(() => new Gender('trans'), GenderError);

        let g = new Gender('male');
        assert.strictEqual(g.g, 'male');
        g = new Gender('female');
        assert.strictEqual(g.g, 'female');
        g = new Gender('other');
        assert.strictEqual(g.g, 'other');
    });

    it('check static get MALE', function () {
        assert.strictEqual(Gender.MALE.g, 'male');
    });

    it('check static get FEMALE', function () {
        assert.strictEqual(Gender.FEMALE.g, 'female');
    });

    it('check static get OTHER', function () {
        assert.strictEqual(Gender.OTHER.g, 'other');
    });

    it('check toString()', function () {
        assert.strictEqual(new Gender('male').toString(), 'male');
    });

    it('check toJSON()', function () {
        assert.strictEqual(new Gender('male').toJSON(), 'male');
    });
});