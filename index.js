const ENV = require('./lib/env');
const app = require('./infrastructure/api/api');

app.listen(ENV.PORT);
console.log(`Running on port ${ENV.PORT}`);
