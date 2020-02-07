const express = require('express');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const apiutils = require('./utils');
const ENV = require('../../lib/env');

const app = express();
const auth2 = new OAuth2Client(CLIENT_ID);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/login', async (req, res) => {
    const token = req.body.token;
    let ticket;
    try {
        ticket = await verifyGoogleIdToken(auth2, token, ENV.CLIENT_ID);
    } catch (err) {
        apiutils.clientError(res, 'token not valid', 401);
        return;
    }
    const payload = ticket.getPayload();
    // check if user is present
    // if not creates it
    // generate new user access token for our platform
});
