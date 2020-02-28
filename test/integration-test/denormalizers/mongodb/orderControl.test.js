const assert = require('assert');
const uuid = require('uuid/v4');
const orderCtrlFunc = require('../../../../infrastructure/denormalizers/mongodb/orderControl');

const ordCtrlDB = process.env.TEST === 'integration' ? 'dynamodb' : 'testdb';
const endpoint = process.env.CLOUD === 'aws' ? undefined : 'http://localhost:4569';

const orderCtrl = orderCtrlFunc(ordCtrlDB, { tableName: 'DenormOrderControlTest', endpoint });

const repo = orderCtrl.db;

describe('order control unit test', function () {
    if (process.env.TEST === 'integration') {
        this.timeout(5000);
        this.slow(500);
    }
    let streamId1;
    let streamId2;

    beforeEach(async () => {
        streamId1 = uuid();
        streamId2 = uuid();
        if (typeof repo.reset === 'function')
            await repo.reset();
    });

    it('check getLastProcessedEvent works', async function () {
        const response = await orderCtrl.getLastProcessedEvent(streamId1);
        assert.strictEqual(response.eventId, 0);
    });

    it('check getLastProcessedEvents works', async function () {
        const response = await orderCtrl.getLastProcessedEvents([streamId1, streamId2]);
        assert.strictEqual(response[0].eventId, 0);
        assert.strictEqual(response[1].eventId, 0);
    });

    it('check getLastProcessedEvent works', async function () {
        await orderCtrl.updateLastProcessedEvent(streamId1, 0);
        const response1 = await orderCtrl.getLastProcessedEvent(streamId1);
        assert.strictEqual(response1.eventId, 1);

        await orderCtrl.updateLastProcessedEvent(streamId1, 1, 4);
        const response2 = await orderCtrl.getLastProcessedEvent(streamId1);
        assert.strictEqual(response2.eventId, 4);
    });

    it('check getLastProcessedEvent works', async function () {
        const updates1 = [
            {
                streamId: streamId1,
                last: 0,
            },
            {
                streamId: streamId2,
                last: 0,
                new: 3,
            },
        ];
        await orderCtrl.updateLastProcessedEvents(updates1);
        const response1 = await orderCtrl.getLastProcessedEvents([streamId1, streamId2]);
        assert.strictEqual(response1[0].eventId, 1);
        assert.strictEqual(response1[1].eventId, 3);

        const updates2 = {
            [streamId1]: {
                last: 1,
            },
            [streamId2]: {
                last: 3,
                new: 5,
            },
        };
        await orderCtrl.updateLastProcessedEvents(updates2);
        const response2 = await orderCtrl.getLastProcessedEvents([streamId1, streamId2]);
        assert.strictEqual(response2[0].eventId, 2);
        assert.strictEqual(response2[1].eventId, 5);
    });

    after(async () => {
        if (typeof repo.reset === 'function')
            await repo.reset();
    });
});
