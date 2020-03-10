const assert = require('assert');
const uuid = require('uuid/v4');
const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const MongoClient = require('mongodb').MongoClient;
const Event = require('@danver97/event-sourcing/event');
const writerFunc = require('../../../../infrastructure/denormalizers/mongodb/writer');
const utils = require('./utils');

const mongod = new MongoMemoryServer();
let client = null;
let collection = null;
let writer = null;

function toJSON(obj) {
    return JSON.parse(JSON.stringify(obj));
}

describe('writer unit test', function () {
    if (process.env.TEST === 'integration') {
        this.timeout(5000);
        this.slow(500);
    }
    let org;
    let role;
    let user;

    before(async function () {
        this.timeout(10000);
        let mongoConfig;
        if (!process.env.TEST || process.env.TEST === 'unit') {
            mongoConfig = {
                url: await mongod.getConnectionString(),
                db: 'auth',
                collection: 'auth',
            };
        } else {
            mongoConfig = {
                url: process.env.MONGODB_URL,
                db: process.env.MONGODB_DBNAME,
                collection: process.env.MONGODB_COLLECTION,
            };            
        }
        console.log(mongoConfig.url);
        client = new MongoClient(mongoConfig.url, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        collection = client.db(mongoConfig.db).collection(mongoConfig.collection);
        writer = await writerFunc(mongoConfig);
    });

    beforeEach(() => {
        org = utils.organization(null, null, [], []);
        roleDef = utils.roleDef();
        roleInstance = utils.roleInstance(roleDef, { orgId: org.orgId });
        user = utils.user();
        return collection.deleteMany({});
    });

    it('check if organizationCreated works', async function () {
        // Update done
        const e = new Event(org.orgId, 1, 'organizationCreated', toJSON(org));
        await writer.organizationCreated(e);

        // Assertions
        const doc = await collection.findOne({ _id: org.orgId });
        org._type = 'organization';
        assert.deepStrictEqual(doc, toJSON(org));
    });

    it('check if roleDefinitionAdded works', async function () {
        // Preset
        await collection.insertOne(toJSON(org));

        // Update done
        const e = new Event(org.orgId, 2, 'roleDefinitionAdded', { orgId: org.orgId, roleDef: toJSON(roleDef) });
        await writer.roleDefinitionAdded(e);

        // Assertions
        const doc = await collection.findOne({ _id: roleDef.roleDefId });
        roleDef._type = 'roleDef';
        assert.deepStrictEqual(doc, toJSON(roleDef));
    });

    it('check if roleDefinitionChanged works', async function () {
        // Preset
        await collection.insertOne(toJSON(org));
        await collection.insertOne(toJSON(roleDef));

        // Update done
        roleDef.name = 'name2';
        roleDef.permissions = [utils.permissionDef('reservation-service', 'acceptReservation', 'Allows to accept reservations', {
            orgId: { name: 'OrganizationId', description: 'The id of the organization the user belongs to', required: true }
        })];
        const e = new Event(org.orgId, 3, 'roleDefinitionChanged', { orgId: org.orgId, roleDef: toJSON(roleDef) });
        await writer.roleDefinitionChanged(e);

        // Assertions
        const doc = await collection.findOne({ _id: roleDef.roleDefId });
        assert.deepStrictEqual(doc, toJSON(roleDef));
    });

    it('check if roleDefinitionRemoved works', async function () {
        // Preset
        await collection.insertOne(toJSON(org));
        await collection.insertOne(toJSON(roleDef));

        // Update done
        const e = new Event(org.orgId, 3, 'roleDefinitionRemoved', { orgId: org.orgId, roleDefId: roleDef.roleDefId });
        await writer.roleDefinitionRemoved(e);

        // Assertions
        const doc = await collection.findOne({ _id: roleDef.roleId });
        assert.deepStrictEqual(doc, null);
    });

    it('check if userAdded works', async function () {
        // Preset
        await collection.insertOne(toJSON(user));
        await collection.insertOne(toJSON(org));
        await collection.insertOne(toJSON(roleDef));

        // Update to do
        user.organizations = [org.orgId];

        // Update done
        const e = new Event(org.orgId, 4, 'userAdded', { orgId: org.orgId, userId: user.uniqueId });
        await writer.userAdded(e);

        // Assertions
        const doc = await collection.findOne({ _id: user.uniqueId });
        assert.deepStrictEqual(doc, toJSON(user));
    });

    it('check if rolesAssignedToUser works', async function () {
        // Preset
        user.organizations = [org.orgId];
        await collection.insertOne(toJSON(user));
        await collection.insertOne(toJSON(org));
        await collection.insertOne(toJSON(roleDef));

        // Update to do
        user.roles = { [org.orgId]: [roleInstance] };

        // Update done
        const e = new Event(org.orgId, 5, 'rolesAssignedToUser', { orgId: org.orgId, userId: user.uniqueId, roles: toJSON([roleInstance]) });
        await writer.rolesAssignedToUser(e);

        // Assertions
        const doc = await collection.findOne({ _id: user.uniqueId });
        assert.deepStrictEqual(doc, toJSON(user));
    });

    it('check if rolesRemovedFromUser works', async function () {
        // Preset
        user.organizations = [org.orgId];
        user.roles = { [org.orgId]: [roleInstance] };
        await collection.insertOne(toJSON(user));
        await collection.insertOne(toJSON(org));
        await collection.insertOne(toJSON(roleDef));

        // Update to do
        user.roles[org.orgId] = [];

        // Update done
        const e = new Event(org.orgId, 6, 'rolesRemovedFromUser', { orgId: org.orgId, userId: user.uniqueId, roles: [toJSON(roleInstance).roleDefId] });
        await writer.rolesRemovedFromUser(e);

        // Assertions
        const doc = await collection.findOne({ _id: user.uniqueId });
        assert.deepStrictEqual(doc, toJSON(user));
    });

    it('check if userRemoved works', async function () {
        // Preset
        user.organizations = [org.orgId];
        user.roles = { [org.orgId]: [roleDef.roleId] };
        await collection.insertOne(toJSON(user));
        await collection.insertOne(toJSON(org));
        await collection.insertOne(toJSON(roleDef));

        // Update to do
        user.organizations = [];
        user.roles = {};

        // Update done
        const e = new Event(org.orgId, 7, 'userRemoved', { orgId: org.orgId, userId: user.uniqueId });
        await writer.userRemoved(e);

        // Assertions
        const doc = await collection.findOne({ _id: user.uniqueId });
        assert.deepStrictEqual(doc, user);
    });

    it('check if organizationRemoved works', async function () {
        // Preset
        await collection.insertOne(toJSON(org));

        // Update done
        const e = new Event(org.orgId, 2, 'organizationRemoved', { orgId: org.orgId, status: 'deleted' });
        await writer.organizationRemoved(e);

        // Assertions
        const doc = await collection.findOne({ _id: org.orgId });
        assert.deepStrictEqual(doc, null);
    });

    it('check if userCreated works', async function () {
        // Update done
        const e = new Event(user.uniqueId, 1, 'userCreated', toJSON(user));
        await writer.userCreated(e);

        // Assertions
        const doc = await collection.findOne({ _id: user.uniqueId });
        user._type = 'user';
        assert.deepStrictEqual(doc, user);
    });

    after(async () => {
        await client.close();
        await mongod.stop();
    });

});
