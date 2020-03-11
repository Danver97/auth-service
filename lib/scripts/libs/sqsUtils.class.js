const BaseUtils = require('./baseUtils.class');

class SQSUtils extends BaseUtils {
    constructor({ microserviceName, environment, client, logLevel }) {
        super({ microserviceName, environment, logLevel });
        this.sqs = client;
    }

    async createQueue(QueueName, QueueOptions = {}) {
        const Attributes = Object.assign({
            VisibilityTimeout: '3',
        }, QueueOptions);
        const response = await this.sqs.createQueue({
            QueueName,
            Attributes,
            tags: {
                Environment: this.environment
            }
        }).promise();
        const QueueUrl = response.QueueUrl;
        return QueueUrl;
    }

    /**
     * 
     * @param {Object} options 
     * @param {Object} options.QueueUrl 
     * @param {Object} [options.QueueArn] 
     * @param {Object} options.TopicArn 
     */
    async addSubscriptionPermission(options) {
        const { QueueUrl, TopicArn } = options;
        let { QueueArn } = options;
        if (!QueueArn)
            QueueArn = await this.getQueueArn({ QueueUrl });
        const policy = {
            Version: '2012-10-17',
            Id: 'arn:aws:sqs:eu-west-2:901546846327:authQueue/SQSDefaultPolicy',
            Statement: [{
                Sid: '1',
                Effect: 'Allow',
                Principal: {
                    AWS: '*'
                },
                Action: 'SQS:SendMessage',
                Resource: QueueArn,
                Condition: {
                    ArnEquals: {
                        'aws:SourceArn': TopicArn,
                    }
                }
            }]
        };

        await this.sqs.setQueueAttributes({
            Attributes: {
                Policy: JSON.stringify(policy),
            },
            QueueUrl,
        }).promise();
    }

    async getQueueUrl(QueueName) {
        let response;
        try {
            response = await this.sqs.getQueueUrl({ QueueName }).promise();
        } catch (err) {
            if (err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
                this.log(`Queue ${QueueName} does not exists`);
                return;
            }
            throw err;
        }
        return response.QueueUrl;
    }

    /**
     * 
     * @param {Object} options 
     * @param {string} [options.QueueName] 
     * @param {string} [options.QueueUrl] 
     */
    async getQueueArn(options = {}) {
        const { QueueName } = options;
        let { QueueUrl } = options;
        let response
        try {
            if (!QueueUrl)
                QueueUrl = await this.getQueueUrl(QueueName);
            response = await this.sqs.getQueueAttributes({
                QueueUrl, /* required */
                AttributeNames: ['QueueArn'],
            }).promise();
        } catch (err) {
            if (err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
                this.log(`Queue ${QueueUrl ? QueueUrl : QueueName} does not exists`);
                return;
            }
            throw err;
        }
        return response.Attributes.QueueArn;
    }

    async deleteQueue(QueueUrl) {
        try {
            await this.sqs.deleteQueue({ QueueUrl }).promise();
        } catch (err) {
            if (err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
                this.log(`Queue ${QueueUrl} does not exists`);
                return;
            }
            throw err;
        }
    }

}

module.exports = SQSUtils;
