const MongoClient = require('mongodb').MongoClient;
// const ESClient = require('@elastic/elasticsearch').Client;
const QueryError = require('./query.error');
const QueryManager = require('./repo');

let mongo;
let esClient;

function checkParameters(mongoOptions /* , esOptions */) {
    let errorStr = 'Missing the following parameters:';
    let throwError = false;
    if (!mongoOptions.connString) {
        throwError = true;
        errorStr += ' mongoOptions.connString';
    }
    if (!mongoOptions.dbName) {
        throwError = true;
        errorStr += ' mongoOptions.dbName';
    }
    if (!mongoOptions.collectionName) {
        throwError = true;
        errorStr += ' mongoOptions.collectionName';
    }
    
    /*if (!esOptions.url) {
        throwError = true;
        errorStr += ' esOptions.url';
    }
    if (!esOptions.index) {
        throwError = true;
        errorStr += ' esOptions.index';
    }*/

    if (throwError)
        throw new QueryError(errorStr, QueryError.paramError);
}

async function exportFunc(mongoOptions = {} /* , esOptions = {} */) {
    // console.log(mongoOptions.connString);
    checkParameters(mongoOptions /* , esOptions */);
    mongo = new MongoClient(mongoOptions.connString, { useNewUrlParser: true, useUnifiedTopology: true });
    await mongo.connect();
    // esClient = new ESClient({ node: esOptions.url });
    mongoCollection = mongo.db(mongoOptions.dbName).collection(mongoOptions.collectionName);
    return new QueryManager(mongoCollection /* , { client: esClient, index: esOptions.index } */);
}

module.exports = exportFunc;
