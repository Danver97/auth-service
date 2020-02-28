const Event = require('@danver97/event-sourcing/event');
var attr = require('dynamodb-data-types').AttributeValue;
const AWS = require('aws-sdk/global');

AWS.config.update({region: 'eu-west-2'});

const handlerFunc = require('./handler');
const orderControlFunc = require('./orderControl');
const writerFunc = require('./writer');

// Test event
/*
{
    "Records": [
        {
            "Type" : "Notification",
            "MessageId" : "ecaeb766-bad7-50a6-be63-e2930f7ebfef",
            "TopicArn" : "arn:aws:sns:eu-west-2:901546846327:restaurant_catalogTopic",
            "Message" : "{\"StreamId\":{\"S\":\"0eb893e2-c57c-4996-a5c5-0fd30da5be88\"},\"Message\":{\"S\":\"restaurantCreated\"},\"ReplayStreamId\":{\"N\":\"0\"},\"RSSortKey\":{\"S\":\"0eb893e2-c57c-4996-a5c5-0fd30da5be88:1\"},\"EventId\":{\"N\":\"1\"},\"Payload\":{\"M\":{\"owner\":{\"S\":\"Giacomo\"},\"restaurantName\":{\"S\":\"I quattro cantoni\"},\"id\":{\"S\":\"0eb893e2-c57c-4996-a5c5-0fd30da5be88\"}}},\"SequenceNumber\":\"1494049400000000003120519833\"}",
            "Timestamp" : "2019-09-13T15:19:05.703Z",
            "SignatureVersion" : "1",
            "Signature" : "VTzuu81MDKrM1IfHHF42ovzSaAUisvrbd3EMBya3FdcYlWGK8MD4P7lKXzw5boSYlTpHFSCisR5ishJw89FDFXZefGO7dPV1JcExrX0Cy5oQzzlmSYgOOU+vhi7zpwtfcoBAvLei6KWCeGFqhqbDu0U9xdH8OTU1krZMT6Q1Tj4zWq69KGdb46dJ/78O5VW5/MI1RuMPqGcEQn1kZ1/XVuEkg7J8N+3CDo/PKSLYBWaQy8VoIfVrlD8gKqrueKaK2xp0HDY+xlheWj325z6TUVrtIC4fjdTqM7IDcs6CQfgq/q2CmdA9UPG/OtYRZuS9zK8o/lB5aBI0ZK2RKv5+Og==",
            "SigningCertURL" : "https://sns.eu-west-2.amazonaws.com/SimpleNotificationService-6aad65c2f9911b05cd53efda11f913f9.pem",
            "UnsubscribeURL" : "https://sns.eu-west-2.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:eu-west-2:901546846327:restaurant_catalogTopic:428ee15f-033d-4271-a4c1-001ccd79c4de",
            "MessageAttributes" : {
                "StreamId" : {"Type":"String","Value":"0eb893e2-c57c-4996-a5c5-0fd30da5be88"},
                "Message" : {"Type":"String","Value":"restaurantCreated"},
                "SequenceNumber" : {"Type":"String","Value":"1494049400000000003120519833"},
                "EventId" : {"Type":"String","Value":"1"}
            }
        }
    ]
}
*/

/*function unwrap(o) {
    if (typeof o !== 'object')
        return o;
    if (o.S)
        return o.S;
    if (o.M)
        return o.M;
    if (o.SS)
        return o.SS;
    if (o.N)
        return o.N;
    return o;
}*/

const orderCtrlDb = process.env.ORDER_CONTROL_DB;
const writerOptions = {
    url: process.env.MONGODB_URL,
    db: process.env.MONGODB_DBNAME,
    collection: process.env.MONGODB_COLLECTION,
};

let writer, orderControl, handler;

async function init() {
    writer = await writerFunc(writerOptions);
    orderControl = orderControlFunc(orderCtrlDb, { fromEnv: true });
    handler = handlerFunc(writer, orderControl, 'log');
}

exports.mongoDenormalizer = async function(event) {
    console.log('mongoDenormalizer');
    if (!writer || !orderControl || !handler)
        await init();
    const messages = event.Records.map(r => {
        const body = JSON.parse(r.body);
        const event = JSON.parse(body.Message);
        delete event.SequenceNumber;
        return Event.fromObject(attr.unwrap(event))
    });
    const promises = [];
    for (let m of messages) {
        promises.push(handler.handleEvent(m));
    }
    await Promise.all(promises);
}