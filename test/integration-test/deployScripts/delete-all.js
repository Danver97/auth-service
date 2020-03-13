const Core = require('../../../lib/scripts/Core.class');
const Projection = require('../../../lib/scripts/Projection.class');

const credentials = {
    accessKeyId: process.env.DEPLOY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.DEPLOY_AWS_SECRET_ACCESS_KEY,
};

async function run() {
    const core = Core.deserialize(credentials);
    const proj = Projection.deserialize(credentials);
    await proj.destroy();
    await core.destroy();
}

run();
