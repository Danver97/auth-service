const BaseUtils = require('./baseUtils.class');

class LambdaUtils extends BaseUtils {
    constructor({ microserviceName, environment, client, logLevel }) {
        super({ microserviceName, environment, logLevel });
        this.lambda = client;
    }
    

    /**
     * Creates a new Lambda function
     * @param {Object} options 
     * @param {Object} options.FunctionName 
     * @param {Object} options.ZipFile 
     * @param {Object} options.Handler 
     * @param {Object} options.RoleArn 
     * @param {Object} [options.envVars] 
     * @param {Object} [options.Runtime] 
     * @param {Object} [options.MemorySize] 
     * @param {Object} [options.Description] 
     */
    async createLambda(options = {}, leakError) {
        const { FunctionName, RoleArn, ZipFile, Handler, envVars = {}, Runtime = 'nodejs12.x', MemorySize = 128, Timeout = 3, Description } = options;
        let response;
        try {
            const params = {
                Code: {
                    ZipFile,
                },
                Description,
                FunctionName,
                Handler, // is of the form of the name of your source file and then name of your function handler
                MemorySize,
                Publish: true,
                Role: RoleArn, // replace with the actual arn of the execution role you created
                Runtime,
                Timeout,
                Environment: {
                    Variables: envVars
                },
                Tags: {
                    Environment: this.environment,
                }
            };
            response = await this.lambda.createFunction(params).promise();
        } catch (err) {
            if (err.code === 'ResourceConflictException' && !leakError) {
                this.log(`Function already exist: ${FunctionName}`);
                return;
            }
            throw err;
        }
        return response;
    }

    /**
     * Creates a new Lambda function
     * @param {Object} options 
     * @param {Object} options.FunctionName 
     * @param {Object} options.ZipFile 
     * @param {Object} [options.Handler] 
     * @param {Object} [options.RoleArn] 
     * @param {Object} [options.envVars] 
     * @param {Object} [options.Runtime] 
     * @param {Object} [options.MemorySize] 
     * @param {Object} [options.Description] 
     */
    async publishNewVersion(options = {}) {
        const { FunctionName, ZipFile, Handler, RoleArn, envVars, Runtime = 'nodejs12.x', MemorySize = 128, Timeout = 3, Description } = options;
        const previousConfig = await this.lambda.updateFunctionCode({
            FunctionName,
            Publish: true,
            ZipFile,
        }).promise();
        const RevisionId = previousConfig.RevisionId;
        await this.lambda.updateFunctionConfiguration({
            FunctionName,
            Handler: Handler || previousConfig.Handler,
            Role: RoleArn || previousConfig.Role,
            Runtime,
            MemorySize,
            Timeout,
            Description,
            Environment: {
                Variables: envVars || previousConfig.Environment.Variables,
            },
            RevisionId,
        }).promise();
        return RevisionId;
    }

    /**
     * 
     * @param {Object} options 
     * @param {string} options.FunctionName Lambda function name to which create the mapping
     * @param {string} [options.StreamArn] Arn of the DynamoDB stream to which create a mapping
     * @param {string} [options.QueueArn] Arn of the SQS queue to which create a mapping
     */
    async createEventSourceMapping(options) {
        const { FunctionName, StreamArn, QueueArn } = options;

        const EventSourceArn = StreamArn || QueueArn;
        const BatchSize = 10;

        const params = {
            EventSourceArn,
            FunctionName,
            BatchSize,
        };
        if (StreamArn) {
            params.StartingPosition = 'LATEST';
            params.BatchSize = 1000;
        }
        let response2;
        try {
            response2 = await this.lambda.createEventSourceMapping(params).promise();
        } catch (err) {
            if (err.code === 'ResourceConflictException') {
                this.log('EventSourceMapping already exists');
                const UUID = /UUID (.*)/.exec(err.message)[1];
                return UUID;
            } else
                throw err;
        }
        return response2.UUID;
    }

    async deleteEventSourceMapping(UUID) {
        await this.lambda.deleteEventSourceMapping({ UUID });
    }

    async deleteLambda(FunctionName) {
        try {
            await this.lambda.deleteFunction({ FunctionName }).promise();
        } catch (err) {
            if (err.code === 'ResourceNotFoundException') {
                this.log(`Lambda ${FunctionName} does not exists`);
                return;
            }
            throw err;
        }
    }

}

module.exports = LambdaUtils;
