const OrderControlRecord = require('./OrderControlRecord.class');

class TestOrderControlDb {
    constructor() {
        this.db = {};
    }

    async getOne(streamId) {
        return OrderControlRecord.fromObject({ streamId, eventId: this.db[streamId] || 0 });
    }

    async getMultiple(streamIds) {
        return streamIds.map(
            streamId => OrderControlRecord.fromObject({ streamId, eventId: this.db[streamId] || 0 })
        );
    }

    updateOne(streamId, lastEventId, newEventId) {
        if ((this.db[streamId] === 0 && lastEventId !== 0) || (this.db[streamId] && this.db[streamId] !== lastEventId))
            throw new Error(`streamId last (${this.db[streamId]}) is different from the provided last (${lastEventId})`);
        
        this.db[streamId] = newEventId || lastEventId + 1;
        return Promise.resolve();
    }

    updateMultiple(updates) {
        if (Array.isArray(updates)) {
            const promises = updates.map(e => this.updateOne(e.streamId, e.last, e.new));
            return Promise.all(promises);
        }
        if (typeof updates === 'object') {
            const promises = Object.keys(updates).map(k => this.updateOne(k, updates[k].last, updates[k].new));
            return Promise.all(promises);
        }
    }

    async reset() {
        this.db = {};
    }
}

const testdb = new TestOrderControlDb();
testdb.class = TestOrderControlDb;

module.exports = () => testdb;
