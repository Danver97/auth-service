const Endpoint = require('aws-sdk/global').Endpoint;
const DDB = require('aws-sdk/clients/dynamodb');
const ddbDataTypes = require('dynamodb-data-types').AttributeValue;

// const dynamodb = new DDB({apiVersion: '2012-08-10'});

function wrap(data) {
    return ddbDataTypes.wrap(data);
}
function wrap1(data) {
    return ddbDataTypes.wrap1(data);
}
function unwrap(data) {
    return ddbDataTypes.unwrap(data);
}

class DynamoOrderControlDb {
    constructor(tableName, endpoint) {
        if (!tableName) {
            throw new Error(
                `OrderControlError: missing the following parameters in the export function ${tableName ? '' : 'tableName'}`
            );
        }
        const ddbOptions = { apiVersion: '2012-08-10' };
        if (endpoint)
            ddbOptions.endpoint = new Endpoint(endpoint);
        this.dynamodb = new DDB(ddbOptions);
        this.tableName = tableName;
    }

    async getOne(streamId) {
        const params = {
            Key: {
                StreamId: wrap1(streamId),
            },
            TableName: this.tableName,
            ConsistentRead: true,
        };
        const response = await this.dynamodb.getItem(params).promise();
        const item = unwrap(response.Item);
        return { streamId: item.StreamId, eventId: item.LastProcessedEventId };
    }

    async getMultiple(streamIds) {
        const keys = streamIds.map(sId => ({ StreamId: wrap1(sId) }));
        const params = {
            RequestItems: {
                [this.tableName]: {
                    Keys: keys,
                    ConsistentRead: true,
                },
            },
        };
        const response = await this.dynamodb.batchGetItem(params).promise();
        const items = response.Responses[this.tableName]
            .map(elem => unwrap(elem))
            .map(item => ({streamId: item.StreamId, eventId: item.LastProcessedEventId}));
        return items;
    }

    updateOne(streamId, lastEventId, newEventId) {
        let conditionalExp;
        const exprAttrs = {
            ":lpei": wrap1(lastEventId),
            ":npei": wrap1(newEventId || lastEventId + 1),
        }
        if (lastEventId === 0 && newEventId === 1) {
            exprAttrs[':zero'] = wrap1(0);
            delete exprAttrs[':lpei'];
            conditionalExp = 'attribute_not_exists(#LPEI) OR #LPEI = :zero';
        } else {
            conditionalExp = '#LPEI = :lpei';
        }
        const params = {
            ExpressionAttributeNames: {
                "#LPEI": "LastProcessedEventId",
            },
            ExpressionAttributeValues: exprAttrs,
            Key: {
                StreamId: wrap1(streamId),
            },
            ReturnValues: "ALL_NEW",
            TableName: this.tableName,
            ConditionExpression: conditionalExp,
            UpdateExpression: "SET #LPEI = :npei",
        };
        return this.dynamodb.updateItem(params).promise();
    }

    updateMultiple(updates) {
        if (Array.isArray(updates)) {
            const promises = updates.map(e => updateLastProcessedEvent(e.streamId, e.last, e.new));
            return Promise.all(promises);
        }
        if (typeof updates === 'object') {
            const promises = Object.keys(updates).map(k => updateLastProcessedEvent(k, updates[k].last, updates[k].new));
            return Promise.all(promises);
        }
    }

    async reset() {
        //TODO
    }
}

let db = new DynamoOrderControlDb(process.env.ORDER_CONTROL_TABLE, process.env.ORDER_CONTROL_DB_URL);

module.exports = function (options) {
    if (options) { 
        if (options.fromEnv)
            db = new DynamoOrderControlDb(process.env.ORDER_CONTROL_TABLE, process.env.ORDER_CONTROL_DB_URL);
        else
            db = new DynamoOrderControlDb(options.tableName, options.endpoint);
    }
    return db;
}
