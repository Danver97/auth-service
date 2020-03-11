const fs = require('fs');
const AdamZip = require('adm-zip');
const { execSync } = require('child_process');

class BaseUtils {
    constructor({ microserviceName, environment = 'noEnv', logLevel }) {
        this.microserviceName = microserviceName || process.env.MICROSERVICE_NAME;
        this.environment = environment;

        this._configureLog(logLevel);
    }
    
    _configureLog(logLevel) {
        this.logLevels = {
            log: 0,
            warn: 1,
            err: 2,
            noLog: 100,
        }
        this.logLevel = this.logLevels[logLevel] || this.logLevels.log;
    }

    log(obj) {
        if (this.logLevel <= this.logLevels.log)
            console.log(obj);
    }
    
    /**
     * 
     * @param {Object} options 
     * @param {string} options.file Path to the single file to zip
     * @param {string} options.folder Path to the package on which install npm dependencies and to zip
     * @param {Object} debugOptions 
     * @param {boolean} debugOptions.dumpZip Writes zip file
     * @param {boolean} debugOptions.logInstall Log 'npm install' output
     */
    _createLambdaDeploymentPackage(options = {}, debugOptions = {}) {
        const { folder, file } = options;
        const zip = new AdamZip();

        if (!folder && !file)
            throw new Error('Missing folder and file paramters from options');
        if (folder && file)
            throw new Error('Please specify just one between folder and file paramters from options');

        if (file) {
            const splits = file.split(/\\|\//);
            const zipfilename = splits[splits.length - 1];
            const data = fs.readFileSync(file, { encoding: 'utf8' });
            zip.addFile(zipfilename, Buffer.alloc(data.length, data));
        }

        if (folder) {
            const result = execSync(`cd ${folder} && npm install`);
            if (debugOptions.logInstall)
                this.log(result.toString());
            zip.addLocalFolder(folder);
            fs.rmdirSync(`${folder}/node_modules`, { recursive: true });
        }

        const buff = zip.toBuffer();
        if (debugOptions.dumpZip)
            zip.writeZip('./deploymentPackage.zip');
        return buff;
    }
}

module.exports = BaseUtils;
