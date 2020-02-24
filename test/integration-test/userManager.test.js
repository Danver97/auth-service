const assert = require('assert');
const DynamoDB = require('aws-sdk/clients/dynamodb');
const ENV = require('../../lib/env');
const User = require('../../domain/models/user.class');
const userEvents = require('../../lib/user-events');
const UserManager = require('../../domain/logic/userManager');
const repo = require('../../infrastructure/repository/repositoryManager')('dynamodb');
const RepositoryError = require('../../infrastructure/repository/repo.error');

const userMgr = new UserManager(repo);

describe('UserManager unit test', function () {
    this.slow(3000);
    this.timeout(10000);
    const userInfo = {
        accountId: 14546434341331,
        accountType: 'Google',
        firstname: 'Christian',
        lastname: 'Paesante',
        email: 'chri.pae@gmail.com',
    };

    beforeEach(async () => {
        if (typeof repo.db.reset === 'function') {
            await repo.db.reset();
        } else {
            const ddb = new DynamoDB({ apiVersion: '2012-08-10', endpoint: ENV.DDB_URL });
            await ddb.deleteItem({
                Key: {
                    StreamId: {
                        S: `${userInfo.accountId}:${userInfo.accountType}`,
                    },
                    EventId: {
                        N: '1'
                    }
                },
                TableName: `${ENV.MICROSERVICE_NAME}EventStreamTable`
            }).promise();
        }
    });

    it('check register works', async function () {
        const user = new User(userInfo);
        await userMgr.register(user);
        const events = await repo.db.getStream(user.uniqueId);
        const lastEvent = events[events.length-1];
        assert.strictEqual(lastEvent.message, userEvents.userCreated);
        // await assert.rejects(() => userMgr.register(user), RepositoryError);
    });

    it('check getUser works', async function () {
        const user = new User(userInfo);
        await userMgr.register(user);
        
        const userSaved = await userMgr.getUser(user.uniqueId);
        user._revisionId = 1;
        assert.deepStrictEqual(userSaved, user)
    });

    it('check login works', async function () {
        const user1 = await userMgr.login(userInfo);
        let events = await repo.db.getStream(user1.uniqueId);
        let lastEvent = events[events.length-1];
        assert.strictEqual(lastEvent.message, userEvents.userCreated);

        const user2 = await userMgr.login(userInfo);
        user1._revisionId = 1;
        assert.deepStrictEqual(user2, user1);
        events = await repo.db.getStream(user1.uniqueId);
        lastEvent = events[events.length-1];
        assert.strictEqual(events.length, 1);
        assert.strictEqual(lastEvent.message, userEvents.userCreated);
    });

});
