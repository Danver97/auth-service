const assert = require('assert');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const permCheck = require('../../infrastructure/api/permissionChecker')('test');
const errHandler = require('../../infrastructure/api/api_error_handler');
const permissionDefs = require('../../domain/permissions');
const defaultRoles = require('../../domain/defaultRoles');
const User = require('../../domain/models/user.class');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/tryit/:orgId', permCheck.checkPermission({ permissionDefs: [permissionDefs.rolesList], params: ['orgId'] }), (req, res) => {
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
        const jwtPayload = Object.assign(user1.toJSON(), { roles: { [orgId]: [defaultRoles.OrganizationOwner.toRole({ orgId })] } });
        const jwtDiffOrg = Object.assign(user1.toJSON(), { roles: { [orgId]: [defaultRoles.OrganizationOwner.toRole({ orgId: 'org3' })] } });

        const token = await permCheck.signJWT(jwtPayload);
        const diffOrgToken = await permCheck.signJWT(jwtDiffOrg);
        const unhautorizedToken = await permCheck.signJWT(user1.toJSON());
        const oldToken = await permCheck.signJWT(Object.assign({ exp: (new Date('2020/03/05')).getTime() }, jwtPayload));

        await req.get(`/tryit/${orgId}`)
            .expect(401);
        await req.get(`/tryit/${orgId}`)
            .set('Authorization', 'Bearer')
            .expect(401);
        await req.get(`/tryit/${orgId}`)
            .set('Authorization', 'Bearer ')
            .expect(401);
        await req.get(`/tryit/${orgId}`)
            .set('Authorization', 'Bearer aaaa.bbbbbb.cccccc')
            .expect(401);
        await req.get(`/tryit/${orgId}`)
            .set('Authorization', `Bearer ${oldToken}`)
            .expect(401);
        await req.get(`/tryit/${orgId}`)
            .set('Authorization', `Bearer ${unhautorizedToken}`)
            .expect(403);
        await req.get(`/tryit/${orgId}`)
            .set('Authorization', `Bearer ${diffOrgToken}`)
            .expect(403);
        await req.get(`/tryit/${orgId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect({ try: 'it' })
            .expect(200);
    });
});
