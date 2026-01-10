// Package config provides configuration builders for application components.
package config

import (
	"fmt"
	"os"
)

// ProcessorConfig holds configuration for the photo processor Lambda.
type ProcessorConfig struct {
	AWSRegion           string
	DynamoDBTablePrefix string
	S3BucketOriginal    string
	S3BucketOptimized   string
	S3BucketThumbnail   string
	APIStage            string
}

// ProcessorConfigBuilder builds ProcessorConfig with validation.
type ProcessorConfigBuilder struct {
	config *ProcessorConfig
	errors []string
}

// NewProcessorConfigBuilder creates a new builder with defaults from environment.
func NewProcessorConfigBuilder() *ProcessorConfigBuilder {
	return &ProcessorConfigBuilder{
		config: &ProcessorConfig{},
		errors: []string{},
	}
}

// FromEnvironment loads all configuration from environment variables.
func (b *ProcessorConfigBuilder) FromEnvironment() *ProcessorConfigBuilder {
	b.config.AWSRegion = os.Getenv("AWS_REGION_NAME")
	b.config.DynamoDBTablePrefix = os.Getenv("DYNAMODB_TABLE_PREFIX")
	b.config.S3BucketOriginal = os.Getenv("S3_BUCKET_ORIGINAL")
	b.config.S3BucketOptimized = os.Getenv("S3_BUCKET_OPTIMIZED")
	b.config.S3BucketThumbnail = os.Getenv("S3_BUCKET_THUMBNAIL")
	b.config.APIStage = os.Getenv("STAGE")
	return b
}

// WithAWSRegion sets the AWS region.
func (b *ProcessorConfigBuilder) WithAWSRegion(region string) *ProcessorConfigBuilder {
	b.config.AWSRegion = region
	return b
}

// WithDynamoDBTablePrefix sets the DynamoDB table prefix.
func (b *ProcessorConfigBuilder) WithDynamoDBTablePrefix(prefix string) *ProcessorConfigBuilder {
	b.config.DynamoDBTablePrefix = prefix
	return b
}

// WithS3Buckets sets all S3 bucket names.
func (b *ProcessorConfigBuilder) WithS3Buckets(original, optimized, thumbnail string) *ProcessorConfigBuilder {
	b.config.S3BucketOriginal = original
	b.config.S3BucketOptimized = optimized
	b.config.S3BucketThumbnail = thumbnail
	return b
}

// WithAPIStage sets the API stage.
func (b *ProcessorConfigBuilder) WithAPIStage(stage string) *ProcessorConfigBuilder {
	b.config.APIStage = stage
	return b
}

// Build validates and returns the configuration.
func (b *ProcessorConfigBuilder) Build() (*ProcessorConfig, error) {
	b.validate()

	if len(b.errors) > 0 {
		return nil, fmt.Errorf("configuration errors: %v", b.errors)
	}

	return b.config, nil
}

func (b *ProcessorConfigBuilder) validate() {
	if b.config.AWSRegion == "" {
		b.errors = append(b.errors, "AWS_REGION_NAME is required")
	}
	if b.config.DynamoDBTablePrefix == "" {
		b.errors = append(b.errors, "DYNAMODB_TABLE_PREFIX is required")
	}
	if b.config.S3BucketOriginal == "" {
		b.errors = append(b.errors, "S3_BUCKET_ORIGINAL is required")
	}
	if b.config.S3BucketOptimized == "" {
		b.errors = append(b.errors, "S3_BUCKET_OPTIMIZED is required")
	}
	if b.config.S3BucketThumbnail == "" {
		b.errors = append(b.errors, "S3_BUCKET_THUMBNAIL is required")
	}
	if b.config.APIStage == "" {
		b.errors = append(b.errors, "STAGE is required")
	}
}

// PhotosTableName returns the photos table name.
func (c *ProcessorConfig) PhotosTableName() string {
	return fmt.Sprintf("%s-photos-%s", c.DynamoDBTablePrefix, c.APIStage)
}

// GalleriesTableName returns the galleries table name.
func (c *ProcessorConfig) GalleriesTableName() string {
	return fmt.Sprintf("%s-galleries-%s", c.DynamoDBTablePrefix, c.APIStage)
}
