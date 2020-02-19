const mongodb = require('mongodb');
const Promisify = require('promisify-cb');
const writerFunc = require('./writer');

let writer = null;

const docTypes = {
    organization: 'organization',
    role: 'role',
    user: 'user',
};

class Writer {
    constructor(url, dbName, collectionName) {
        if (!url || !dbName || !collectionName) {
            throw new Error(`WriterError: missing one of the following parameter in the constructor:
            ${url ? '' : 'url'}
            ${dbName ? '' : 'dbName'}
            ${collectionName ? '' : 'collectionName'}`);
        }
        this.url = url;
        this.dbName = dbName;
        this.collectionName = collectionName;
        // useUnifiedTopology: true necessario per mongodb by Bitnami. Not sure if really necessary.
        this.client = new mongodb.MongoClient(this.url, { useNewUrlParser: true, useUnifiedTopology: true });
    }

    async connect() {
        if (this.client.isConnected())
            return;
        await this.client.connect();
        this.db = this.client.db(this.dbName);
        this.collection = this.db.collection(this.collectionName);
    }

    get isConnected() {
        return this.client.isConnected();
    }

    closeConnection() {
        return this.client.close();
    }

    async close() {
        await this.closeConnection();
    }

    async disconnect() {
        await this.closeConnection();
    }

    /**
     * Ensure client is connected before proceding to sending write operations to the database
     * @param {function} operationCallback Write operation callback
     * @param {Writer~writerCallback} cb Callback for operation callback result
     */
    writeOperation(operationCallback, cb) {
        return Promisify(async () => {
            await this.connect();
            const result = operationCallback();
            if (result instanceof Promise)
                return await result;
            return result;
        }, cb);
    }

    // Write handlers

    organizationCreated(e, cb) {
        const org = e.payload;
        org._id = org.orgId;
        org._type = docTypes.organization;
        return Promisify(() => this.collection.insertOne(org), cb);
    }

    roleAdded(e, cb) {
        const orgId = e.payload.orgId;
        const role = e.payload.role;
        role._id = role.roleId;
        role.orgId = orgId;
        role._type = docTypes.role;
        return Promisify(() => this.collection.insertOne(role), cb);
    }

    roleRemoved(e, cb) {
        const orgId = e.payload.orgId;
        const roleId = e.payload.roleId;
        return Promisify(() => this.collection.deleteOne({ _id: roleId, orgId }), cb);
    }

    userAdded(e, cb) {
        const orgId = e.payload.orgId;
        const userId = e.payload.userId;
        return Promisify(() => this.collection.updateOne({ _id: userId }, { $addToSet: { organizations: orgId }}), cb);
    }

    rolesAssignedToUser(e, cb) {
        const orgId = e.payload.orgId;
        const userId = e.payload.userId;
        const roles = e.payload.roles;
        const rolesField = `roles.${orgId}`;
        return Promisify(() => this.collection.updateOne({ _id: userId, organizations: orgId }, { $addToSet: { [rolesField]: { $each: roles } } }), cb);
    }

    rolesRemovedFromUser(e, cb) {
        const orgId = e.payload.orgId;
        const userId = e.payload.userId;
        const roles = e.payload.roles;
        const rolesField = `roles.${orgId}`;
        return Promisify(() => this.collection.updateOne({ _id: userId, organizations: orgId }, { $pullAll: { [rolesField]: roles } }), cb);
    }

    userRemoved(e, cb) {
        const orgId = e.payload.orgId;
        const userId = e.payload.userId;
        const rolesField = `roles.${orgId}`;
        return Promisify(() => this.collection.updateOne({ _id: userId }, { $pull: { organizations: orgId }, $unset: { [rolesField]: "" } }), cb);
    }

    organizationRemoved(e, cb) {
        const orgId = e.payload.orgId;
        return Promisify(() => this.collection.deleteOne({ _id: orgId }), cb);
    }

    userCreated(e, cb) {
        const user = e.payload;
        user._id = user.uniqueId;
        user._type = docTypes.user;
        return Promisify(() => this.collection.insertOne(user), cb);
    }
}

/**
 * @callback Writer~writerCallback
 * @param {object} error Error object
 * @param {any} response Response of the operation
 */

/**
 * Export function for the writer singleton object
 * @param {object} options Export function options
 * @param {object} options.url Url string for the mongodb instance
 * @param {object} options.db Db name of the db
 * @param {object} options.collection Collection name of the db's collection to write to
 */
async function exportFunc(options) {
    function areSameOptions(options) {
        return options.url === writer.url && options.db === writer.dbName && options.collection === writer.collectionName;
    }

    if (!options || (writer && writer.isConnected && areSameOptions(options)))
        return writer;
    writer = new Writer(options.url, options.db, options.collection);
    await writer.connect();
    return writer;
}

module.exports = exportFunc;
