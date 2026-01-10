// Package aws provides a factory for creating AWS service clients.
package aws

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

// S3API defines the S3 operations used by the application.
type S3API interface {
	GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error)
	PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error)
	DeleteObject(ctx context.Context, params *s3.DeleteObjectInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error)
	DeleteObjects(ctx context.Context, params *s3.DeleteObjectsInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectsOutput, error)
}

// DynamoDBAPI defines the DynamoDB operations used by the application.
type DynamoDBAPI interface {
	GetItem(ctx context.Context, params *dynamodb.GetItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error)
	PutItem(ctx context.Context, params *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error)
	UpdateItem(ctx context.Context, params *dynamodb.UpdateItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.UpdateItemOutput, error)
	DeleteItem(ctx context.Context, params *dynamodb.DeleteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.DeleteItemOutput, error)
	Query(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error)
	Scan(ctx context.Context, params *dynamodb.ScanInput, optFns ...func(*dynamodb.Options)) (*dynamodb.ScanOutput, error)
}

// SQSAPI defines the SQS operations used by the application.
type SQSAPI interface {
	SendMessage(ctx context.Context, params *sqs.SendMessageInput, optFns ...func(*sqs.Options)) (*sqs.SendMessageOutput, error)
	ReceiveMessage(ctx context.Context, params *sqs.ReceiveMessageInput, optFns ...func(*sqs.Options)) (*sqs.ReceiveMessageOutput, error)
	DeleteMessage(ctx context.Context, params *sqs.DeleteMessageInput, optFns ...func(*sqs.Options)) (*sqs.DeleteMessageOutput, error)
	GetQueueUrl(ctx context.Context, params *sqs.GetQueueUrlInput, optFns ...func(*sqs.Options)) (*sqs.GetQueueUrlOutput, error)
}

// ClientFactory creates AWS service clients.
type ClientFactory interface {
	NewS3Client() S3API
	NewDynamoDBClient() DynamoDBAPI
	NewSQSClient() SQSAPI
	Config() aws.Config
}

// DefaultClientFactory implements ClientFactory using real AWS SDK clients.
type DefaultClientFactory struct {
	config aws.Config
}

// NewClientFactory creates a new DefaultClientFactory with the given AWS config.
func NewClientFactory(cfg aws.Config) *DefaultClientFactory {
	return &DefaultClientFactory{config: cfg}
}

// NewClientFactoryFromEnv creates a new DefaultClientFactory by loading config from environment.
func NewClientFactoryFromEnv(ctx context.Context, region string) (*DefaultClientFactory, error) {
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, err
	}
	return &DefaultClientFactory{config: cfg}, nil
}

// NewS3Client creates a new S3 client.
func (f *DefaultClientFactory) NewS3Client() S3API {
	return s3.NewFromConfig(f.config)
}

// NewDynamoDBClient creates a new DynamoDB client.
func (f *DefaultClientFactory) NewDynamoDBClient() DynamoDBAPI {
	return dynamodb.NewFromConfig(f.config)
}

// NewSQSClient creates a new SQS client.
func (f *DefaultClientFactory) NewSQSClient() SQSAPI {
	return sqs.NewFromConfig(f.config)
}

// Config returns the underlying AWS config.
func (f *DefaultClientFactory) Config() aws.Config {
	return f.config
}

// Clients holds all AWS clients for convenient access.
type Clients struct {
	S3       S3API
	DynamoDB DynamoDBAPI
	SQS      SQSAPI
}

// NewClients creates all AWS clients from a factory.
func NewClients(factory ClientFactory) *Clients {
	return &Clients{
		S3:       factory.NewS3Client(),
		DynamoDB: factory.NewDynamoDBClient(),
		SQS:      factory.NewSQSClient(),
	}
}

// NewClientsFromEnv creates all AWS clients by loading config from environment.
func NewClientsFromEnv(ctx context.Context, region string) (*Clients, error) {
	factory, err := NewClientFactoryFromEnv(ctx, region)
	if err != nil {
		return nil, err
	}
	return NewClients(factory), nil
}
