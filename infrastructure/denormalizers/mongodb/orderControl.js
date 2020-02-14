const dbFunc = require('./db');

class OrderControlHandler {
    constructor (db) {
        this.db = db;
    }

    getLastProcessedEvent(streamId) {
        return this.db.getOne(streamId);
    }

    getLastProcessedEvents(streamIds) {
        return this.db.getMultiple(streamIds);
    }

    updateLastProcessedEvent(streamId, lastProcessedEventId, newProcessedEventId) {
        return this.db.updateOne(streamId, lastProcessedEventId, newProcessedEventId);
    }

    updateLastProcessedEvents(updates) {
        return this.db.updateMultiple(updates);
    }
}

function exportFunc(dbname, dboptions) {
    const db = dbFunc(dbname, dboptions);
    return new OrderControlHandler(db);
}

module.exports = exportFunc;
