class OrderControlRecord {
    constructor (streamId, eventId) {
        this.streamId = streamId;
        this.eventId = eventId;
    }

    static fromObject(obj) {
        return new OrderControlRecord(obj.StreamId || obj.streamId, obj.EventId || obj.eventId);
    }
}

module.exports = OrderControlRecord;
