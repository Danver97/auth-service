class EventHandler {
    constructor(writer, orderCtrl, logLevel) {
        this.writer = writer;
        this.orderCtrl = orderCtrl;
        this.logLevel = logLevel || 'warn';

    }

    /* organizationCreated(e, cb) {
        return this.writer.organizationCreated(e.payload, cb);
    }

    roleAdded(e, cb) {
        const orgId = e.payload.orgId;
        const role = e.payload.role;
        return this.writer.roleAdded(orgId, role, cb);
    }

    roleRemoved(e, cb) {
        const orgId = e.payload.orgId;
        const roleId = e.payload.roleId;
        return this.writer.roleRemoved(orgId, roleId, cb);
    }

    userAdded(e, cb) {
        const orgId = e.payload.orgId;
        const userId = e.payload.userId;
        return this.writer.userAdded(orgId, userId, cb);
    }

    rolesAssignedToUser(e, cb) {
        const orgId = e.payload.orgId;
        const userId = e.payload.userId;
        const roles = e.payload.roles;
        return this.writer.rolesAssignedToUser(orgId, userId, roles, cb);
    }

    rolesRemovedFromUser(e, cb) {
        const orgId = e.payload.orgId;
        const userId = e.payload.userId;
        const roles = e.payload.roles;
        return this.writer.rolesRemovedFromUser(orgId, userId, roles, cb);
    }

    userRemoved(e, cb) {
        const orgId = e.payload.orgId;
        const userId = e.payload.userId;
        return this.writer.userRemoved(orgId, userId, cb);
    }

    organizationRemoved(e, cb) {
        const orgId = e.payload.orgId;
        return this.writer.organizationRemoved(orgId, cb);
    }

    userCreated(e, cb) {
        return this.writer.userCreated(e.payload, cb);
    } */

    log(type, msg) {
        const types = {
            info: 0,
            log: 1,
            warn: 2,
            err: 3,
        };
        if (types[type] < types[this.logLevel])
            return;
        console[type](`MongoHandler: ${msg}`);
    }

    async handleEvent(e, ack) {
        if (!e)
            return;
        if (typeof this.writer[e.message] === 'function') {
            let lastEventId = (await this.orderCtrl.getLastProcessedEvent(e.streamId)).eventId;
            lastEventId = (lastEventId === undefined || lastEventId === null) ? 0 : lastEventId;
    
            this.log('log', `StreamId: ${e.streamId}
            Last EventId: ${lastEventId}
            Expected EventId: ${lastEventId + 1}
            Current EventId: ${e.eventId}`);
            // If it is and old event
            if (e.eventId <= lastEventId) {
                // Removes it from the queue without processing it
                this.log('warn', `Current EId is lower or equals that lastEId.
                Current event is an old event. Will be removed without processing it.`);
                await acknoledge(ack);
                return;
            }
            // If it is a too young event
            if (e.eventId > lastEventId + 1) {
                // Ignore it
                this.log('warn', `Current EId is bigger that expected EId
                Current event is a future event. Will be ignored without removing it from queue.`);
                this.log('log', `Expected eventId: ${lastEventId + 1}. Found: ${e.eventId}`);
                await dontAcknoledge(ack);
                return;
            }
    
            // If it is the next event that needs to be processed
            if (e.eventId === lastEventId + 1) {
                // Process it
                this.log('log', `Current EId is equal the expected EId
                Current event is the expected event. Will be processed.`);
                await this.writer[e.message](e);
                await this.orderCtrl.updateLastProcessedEvent(e.streamId, lastEventId, e.eventId);
                await acknoledge(ack);
            }
        }
    }
}

async function acknoledgeUtil(ackFunc, ack) {
    if (ack && typeof ackFunc === 'function') {
        await ackFunc();
    } else if (!ack) {
        // If the queue requires acknolegde to remove events, doesn't acknoledges it not calling ackFunc()
        // If the queue requires success of the function to remove events, throws an error
        if (typeof ackFunc !== 'function')
            throw new Error('EventId too much ahead of the expected eventId');
    }

}

function acknoledge(akcFunc) {
    return acknoledgeUtil(akcFunc, true);
}

function dontAcknoledge(akcFunc) {
    return acknoledgeUtil(akcFunc, false);
}

let eventHandler = null;

function exportFunc(writer, orderCtrl, logLevel) {
    if (!writer || !orderCtrl) {
        throw new Error(`HandlerError: Missing one or more of the following parameters:
        ${writer ? '' : 'writer'}
        ${orderCtrl ? '' : 'orderCtrl'}`);
    }
    if (eventHandler && eventHandler.writer == writer && eventHandler.orderCtrl == orderCtrl && eventHandler.logLevel == logLevel)
        return eventHandler;
    eventHandler = new EventHandler(writer, orderCtrl, logLevel);
    return eventHandler;
}

module.exports = exportFunc;
