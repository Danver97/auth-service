const Core = require('../../../lib/scripts/Core.class');
const Projection = require('../../../lib/scripts/Projection.class');

async function run() {
    const core = Core.deserialize();
    const proj = Projection.deserialize();
    await proj.destroy();
    await core.destroy();
}

run();
