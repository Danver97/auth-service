const assert = require('assert');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const permCheck = require('../../infrastructure/api/permissionChecker');
const errHandler = require('../../infrastructure/api/api_error_handler');
const defaultRoles = require('../../domain/defaultRoles');
const User = require('../../domain/models/user.class');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/tryit/:orgId', permCheck.verifyToken, permCheck.checkPermission({ roles: 'OrganizationOwner' }), (req, res) => {
    res.json({ try: 'it' });
});
app.use(errHandler);

const req = request(app);

describe('Access Token utils unit test', function () {
    const orgId = 'org1'
    const user1 = new User({
        accountId: 14546434341331,
        accountType: 'Google',
        firstname: 'Christian',
        lastname: 'Paesante',
        email: 'chri.pae@gmail.com',
    });

    before(async function () {
        this.timeout(20000);
        await permCheck.init();
    });

    it('tryit', async function () {
        const jwtPayload = user1.toJSON();
        const unhautorizedToken = await permCheck.signJWT(jwtPayload);
        jwtPayload.roles = { [orgId]: defaultRoles.filter(r => r.name === 'OrganizationOwner') };
        const oldExp = new Date('2020/03/05');
        const oldToken = await permCheck.signJWT(Object.assign({ exp: oldExp.getTime() }, jwtPayload));
        const token = await permCheck.signJWT(jwtPayload);
        await req.get(`/tryit/${orgId}`)
            .expect(401);
        await req.get(`/tryit/${orgId}`)
            .set('Authentication', 'Bearer')
            .expect(401);
        await req.get(`/tryit/${orgId}`)
            .set('Authentication', 'Bearer ')
            .expect(401);
        await req.get(`/tryit/${orgId}`)
            .set('Authentication', 'Bearer aaaa.bbbbbb.cccccc')
            .expect(401);
        await req.get(`/tryit/${orgId}`)
            .set('Authentication', `Bearer ${oldToken}`)
            .expect(401);
        await req.get(`/tryit/${orgId}`)
            .set('Authentication', `Bearer ${unhautorizedToken}`)
            .expect(403);
        await req.get(`/tryit/${orgId}`)
            .set('Authentication', `Bearer ${token}`)
            .expect({ try: 'it' })
            .expect(200);
    });
});
