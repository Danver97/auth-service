const BaseUtils = require('./baseUtils.class');

class EC2Utils extends BaseUtils {
    constructor({ microserviceName, environment, client, logLevel }) {
        super({ microserviceName, environment, logLevel });
        this.ec2 = client;
    }

    async createKeyPair(KeyName) {
        const response = await this.ec2.createKeyPair({ KeyName }).promise();
        return response.KeyMaterial;
    }

    async deleteKeyPair(KeyName) {
        const response = await this.ec2.deleteKeyPair({ KeyName }).promise();
        return response;
    }

    /**
     * 
     * @param {Object} options 
     * @param {Object} options.KeyName
     * @param {Object} options.LaunchTemplate
     * @param {string} [options.LaunchTemplate.Id] 
     * @param {string} [options.LaunchTemplate.Name] 
     * @param {string} [options.LaunchTemplate.Version] 
     * @returns {string[]} A list of instace ids
     */
    async createInstanceFromTemplate(options = {}) {
        const { KeyName, LaunchTemplate } = options;
        let { MinCount = 1, MaxCount } = options;
        MaxCount = MaxCount || MinCount;
        const { Id: LaunchTemplateId, Name: LaunchTemplateName, Version } = LaunchTemplate;
        const params = { KeyName, MinCount, MaxCount, LaunchTemplate: {} };
        if (LaunchTemplateId)
            params.LaunchTemplate.LaunchTemplateId = LaunchTemplateId;
        else if (LaunchTemplateName)
            params.LaunchTemplate.LaunchTemplateName = LaunchTemplateName;
        if (Version)
            params.LaunchTemplate.Version = Version;

        const response = await this.ec2.runInstances(params).promise();
        return response.Instances.map(i => i.InstanceId);
    }
    
    /**
     * 
     * @param {string[]} InstanceIds 
     */
    async getInstacesStates(InstanceIds) {
        const response = await this.ec2.describeInstanceStatus({
            InstanceIds,
        }).promise();
        const states = response.InstanceStatuses.map(i => i.InstanceState);
        return states;
    }

    /**
     * 
     * @param {string[]} InstanceIds 
     */
    async getInstacesPublicDNS(InstanceIds) {
        const response = await this.ec2.describeInstances({
            InstanceIds,
        }).promise();
        const dnsList = response.Reservations[0].Instances.map(i => i.PublicDnsName); // Not sure about 'Reservations[0]'
        return dnsList;
    }

    /**
     * 
     * @param {string[]} InstanceIds 
     */
    async terminateInstances(InstanceIds) {
        await this.ec2.terminateInstances({ InstanceIds }).promise();
    }
}

module.exports = EC2Utils;
