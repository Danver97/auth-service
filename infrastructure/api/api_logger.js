let logLevel = 'log';

const allowedLevels = {
    log: 1,
    warn: 2,
    err: 3,
}

function log(level, obj) {
    if (allowedLevels[level] >= allowedLevels[logLevel])
        console[logLevel](obj);
}

function setLogLevel(level) {
    if (!level)
        return;
    if (!allowedLevels[level])
        throw new Error(`Log level ${level} not allowed`);
    logLevel = level;
}

module.exports = {
    log,
    setLogLevel,
};
