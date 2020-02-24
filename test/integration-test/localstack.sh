export SERVICES="iam, lambda, dynamodb, dynamodbstreams, sns, sqs"
export DEFAULT_REGION="eu-west-2"

export DYNAMODB_ERROR_PROBABILITY=0

docker-compose -f ./test/integration-test/localstack.yml up localstack

docker rm localstack_main
