const assert = require('assert');
const uuid = require('uuid/v4');
const orderCtrl = require('../../../../infrastructure/denormalizers/mongodb/orderControl')('testdb');

const repo = orderCtrl.db;

describe('order control unit test', function () {
    const streamId1 = uuid();
    const streamId2 = uuid();

    beforeEach(async () => repo.reset());

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
        await orderCtrl.updateLastProcessedEvent(streamId1, 1);
        const response1 = await orderCtrl.getLastProcessedEvent(streamId1);
        assert.strictEqual(response1.eventId, 2);

        await orderCtrl.updateLastProcessedEvent(streamId1, 2, 4);
        const response2 = await orderCtrl.getLastProcessedEvent(streamId1);
        assert.strictEqual(response2.eventId, 4);
    });

    it('check getLastProcessedEvent works', async function () {
        const updates1 = [
            {
                streamId: streamId1,
                last: 1,
            },
            {
                streamId: streamId2,
                last: 1,
                new: 3,
            },
        ];
        await orderCtrl.updateLastProcessedEvents(updates1);
        const response1 = await orderCtrl.getLastProcessedEvents([streamId1, streamId2]);
        assert.strictEqual(response1[0].eventId, 2);
        assert.strictEqual(response1[1].eventId, 3);

        const updates2 = {
            [streamId1]: {
                last: 2,
            },
            [streamId2]: {
                last: 3,
                new: 5,
            },
        };
        await orderCtrl.updateLastProcessedEvents(updates2);
        const response2 = await orderCtrl.getLastProcessedEvents([streamId1, streamId2]);
        assert.strictEqual(response2[0].eventId, 3);
        assert.strictEqual(response2[1].eventId, 5);
    });

    after(async () => {
        await orderCtrl.db.reset();
    });
});
