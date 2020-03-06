const BaseUtils = require('./baseUtils.class');

class DynamoUtils extends BaseUtils {
    constructor({ microserviceName, environment, client, logLevel }) {
        super({ microserviceName, environment, logLevel });
        this.ddb = client;
    }
    
    async buildEventStreamTable(TableName, options = {}) {
        const { RCU = 5, WCU = 5 } = options;
        const response = await this.ddb.createTable({
            TableName,
            AttributeDefinitions: [
                {
                    AttributeName: "StreamId",
                    AttributeType: "S"
                },
                {
                    AttributeName: "EventId",
                    AttributeType: "N"
                },
                {
                    AttributeName: "ReplayStreamId",
                    AttributeType: "N"
                },
                {
                    AttributeName: "RSSortKey",
                    AttributeType: "S"
                },
            ],
            KeySchema: [
                {
                    AttributeName: "StreamId",
                    KeyType: "HASH"
                },
                {
                    AttributeName: "EventId",
                    KeyType: "RANGE"
                }
            ],
            GlobalSecondaryIndexes: [{
                IndexName: 'ReplayIndex', /* required */
                KeySchema: [{
                    AttributeName: 'ReplayStreamId', /* required */
                    KeyType: 'HASH' /* required */
                }, {
                    AttributeName: 'RSSortKey', /* required */
                    KeyType: 'RANGE' /* required */
                }],
                Projection: {
                    ProjectionType: 'ALL'
                },
                ProvisionedThroughput: {
                    ReadCapacityUnits: RCU,
                    WriteCapacityUnits: WCU,
                }
            }],
            StreamSpecification: {
                StreamEnabled: true,
                StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
            ProvisionedThroughput: {
                ReadCapacityUnits: RCU,
                WriteCapacityUnits: WCU
            },
            Tags: [
                {
                    Key: 'Environment',
                    Value: this.environment,
                },
            ]
        }).promise();
        return response.TableDescription.LatestStreamArn;
    }
    
    async buildOrderControlTable(TableName, options = {}) {
        const { RCU = 5, WCU = 5 } = options;
        const response = await this.ddb.createTable({
            TableName,
            AttributeDefinitions: [{
                AttributeName: "StreamId",
                AttributeType: "S"
            }],
            KeySchema: [{
                AttributeName: "StreamId",
                KeyType: "HASH"
            }],
            ProvisionedThroughput: {
                ReadCapacityUnits: RCU,
                WriteCapacityUnits: WCU
            },
            Tags: [
                {
                    Key: 'Environment',
                    Value: this.environment,
                },
            ]
        }).promise();
        return response;
    }

    async getTableStreamArn(TableName) {
        const response = await this.ddb.describeTable({ TableName }).promise();
        return response.Table.LatestStreamArn;
    }

    async deleteTable(TableName) {
        try {
            await this.ddb.deleteTable({ TableName }).promise();
        } catch (err) {
            if (err.code === 'ResourceNotFoundException') {
                this.log(`Table ${TableName} does not exists`);
                return;
            }
            throw err;
        }
    }
}

module.exports = DynamoUtils;
