const BaseUtils = require('./baseUtils.class');

class IAMUtils extends BaseUtils {
    constructor({ microserviceName, environment, client, logLevel }) {
        super({ microserviceName, environment, logLevel });
        this.iam = client;
    }

    async getRoleArn(RoleName) {
        return (await this.iam.getRole({ RoleName }).promise()).Role.Arn;
    }
}

module.exports = IAMUtils;
