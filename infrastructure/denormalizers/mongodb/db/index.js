module.exports = function (dbname, dboptions) {
    const dbName = dbname || process.env.ORDER_CONTROL_DB;
    switch (dbName) {
        case 'testdb':
            return require('./testdb')(dboptions);
        case 'dynamodb':
            return require('./dynamodb')(dboptions);
        default:
    }
}
