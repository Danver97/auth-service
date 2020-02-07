const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const apiutils = require('./utils');
const Validator = require('./tokenValidator');
const ENV = require('../../lib/env');

const app = express();
const auth2 = new Validator(ENV.CLIENT_ID);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.use((req, res, next) => {
    console.log(`${req.method}\t${req.url}`);
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../../index.html'));
});

app.post('/login', async (req, res) => {
    const token = req.body.id_token;
    let ticket;
    try {
        ticket = await auth2.verifyGoogleIdToken(token);
    } catch (err) {
        apiutils.clientError(res, 'token not valid', 401);
        return;
    }
    const payload = ticket.getPayload();
    console.log(payload);
    // check if user is present
    // if not creates it
    // generate new user access token for our platform
});

module.exports = app;
