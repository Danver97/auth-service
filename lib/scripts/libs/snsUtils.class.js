const BaseUtils = require('./baseUtils.class');

class SNSUtils extends BaseUtils {
    constructor({ microserviceName, environment, client, logLevel }) {
        super({ microserviceName, environment, logLevel });
        this.sns = client;
    }
    
    async createTopic(TopicName) {
        const response = await this.sns.createTopic({
            Name: TopicName,
            Tags: [
                {
                    Key: 'Environment',
                    Value: this.environment,
                },
            ]
        }).promise();
        return response.TopicArn;
    }
    
    /**
     * 
     * @param {Object} options 
     * @param {string} options.TopicArn 
     * @param {string} options.QueueArn 
     */
    async subscribeQueueToTopic(options = {}) {
        const { TopicArn, QueueArn } = options;
        const response = await this.sns.subscribe({
            Protocol: 'sqs',
            TopicArn,
            Endpoint: QueueArn,
            ReturnSubscriptionArn: true
        }).promise();
        return response.SubscriptionArn;
    }
    
    async unsubscribeQueueToTopic(SubscriptionArn) {
        const response = await this.sns.unsubscribe({ SubscriptionArn }).promise();
        return response;
    }

    async deleteTopic(TopicArn) {
        await this.sns.deleteTopic({ TopicArn }).promise();
    }
}

module.exports = SNSUtils;
