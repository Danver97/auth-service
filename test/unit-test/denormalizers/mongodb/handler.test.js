const assert = require('assert');
const Event = require('@danver97/event-sourcing/event');
const orderControl = require('../../../../infrastructure/denormalizers/mongodb/orderControl')('testdb');
const handlerFunc = require('../../../../infrastructure/denormalizers/mongodb/handler');

let writer = null;
let handler = null;

function toJSON(obj) {
    return JSON.parse(JSON.stringify(obj));
}

describe('handler unit test', function () {
    let writerCalled = false;
    let acked = false;

    function ack() {
        acked = true;
    }

    before(() => {
        writer = {
            customEvent: () => {
                writerCalled = true;
            }
        };
        handler = handlerFunc(writer, orderControl, 'err');
    });

    beforeEach(() => {
        writerCalled = false;
        acked = false;
    });

    it('check if handleEvent process current event', async function () {
        const e1 = new Event('streamId1', 1, 'customEvent', { customPayload: 'payload' });
        await handler.handleEvent(e1);
        assert.ok(writerCalled);

        writerCalled = false;
        
        const e2 = new Event('streamId2', 1, 'customEvent', { customPayload: 'payload' });
        await handler.handleEvent(e2, ack);
        assert.ok(writerCalled);
        assert.ok(acked);
    });

    it('check if handleEvent do not process past events', async function () {
        const e1 = new Event('streamId1', 1, 'customEvent', { customPayload: 'payload' });
        await handler.handleEvent(e1);
        assert.ok(!writerCalled);

        writerCalled = false;
        
        const e2 = new Event('streamId2', 1, 'customEvent', { customPayload: 'payload' });
        await handler.handleEvent(e2, ack);
        assert.ok(!writerCalled);
        assert.ok(acked);
    });

    it('check if handleEvent do not process future events', async function () {
        const e1 = new Event('streamId1', 3, 'customEvent', { customPayload: 'payload' });
        await assert.rejects(() => handler.handleEvent(e1), Error);
        assert.ok(!writerCalled);

        writerCalled = false;
        
        const e2 = new Event('streamId2', 3, 'customEvent', { customPayload: 'payload' });
        await handler.handleEvent(e2, ack);
        assert.ok(!writerCalled);
        assert.ok(!acked);
    });

});
