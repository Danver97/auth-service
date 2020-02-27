export SERVICES="iam, lambda, dynamodb, dynamodbstreams, sns, sqs, ec2"
export DEFAULT_REGION="eu-west-2"

export DYNAMODB_ERROR_PROBABILITY=0
export LAMBDA_EXECUTOR=docker
# export LAMBDA_DOCKER_NETWORK='localstack.services.generic_proxy'

docker-compose -f ./test/integration-test/localstack.yml up localstack

docker rm localstack_main
