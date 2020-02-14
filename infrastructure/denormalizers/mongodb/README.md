# MongoDb Denormalizer
This package must be deployed as a serverless function.
It needs some env variables to start.

## Environment Variables

| Variable | Description |
| --- | --- |
| MONGODB_URL | MongoDb projection connection string |
| MONGODB_DBNAME | MongoDb db name |
| MONGODB_COLLECTION | MongoDb collection |
| ORDER_CONTROL_DB | Order control db name (example: testdb, dynamodb) |
| ORDER_CONTROL_TABLE | Name of the table used for the order control |
| ORDER_CONTROL_DBURL | (Optional) Url to the order control db instace. Used by DynamoDb implementation in case of a local db instance |

## OrderControl Tables Schema
### DynamoDb

| Field | Type | Description |
| --- | --- | --- |
| StreamId | String | StreamId of the event stream |
| LastProcessedEventId | Number | EventId of the last event processed |

## Troubleshooting
- In caso di deploy su DocumentDb provare a rimuovere l'opzione `useUnifiedTopology: true` nelle opzioni del construttore del client MongoDb. E' utilizzato per rimuovere un errore lanciato durante la connessione all'istanza EC2 MongoDb by Bitnami

