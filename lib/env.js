const dotenv = require('dotenv');

if (process.env.NODE_ENV !== 'production')
    dotenv.config();

const ENV = process.env;

module.exports = ENV;
