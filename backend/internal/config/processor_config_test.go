package config

import (
	"os"
	"strings"
	"testing"
)

func TestProcessorConfigBuilder_FromEnvironment(t *testing.T) {
	// Set environment variables
	os.Setenv("AWS_REGION_NAME", "us-east-1")
	os.Setenv("DYNAMODB_TABLE_PREFIX", "photo-gallery")
	os.Setenv("S3_BUCKET_ORIGINAL", "original-bucket")
	os.Setenv("S3_BUCKET_OPTIMIZED", "optimized-bucket")
	os.Setenv("S3_BUCKET_THUMBNAIL", "thumbnail-bucket")
	os.Setenv("STAGE", "dev")
	defer func() {
		os.Unsetenv("AWS_REGION_NAME")
		os.Unsetenv("DYNAMODB_TABLE_PREFIX")
		os.Unsetenv("S3_BUCKET_ORIGINAL")
		os.Unsetenv("S3_BUCKET_OPTIMIZED")
		os.Unsetenv("S3_BUCKET_THUMBNAIL")
		os.Unsetenv("STAGE")
	}()

	cfg, err := NewProcessorConfigBuilder().FromEnvironment().Build()

	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	if cfg.AWSRegion != "us-east-1" {
		t.Errorf("AWSRegion = %v, want us-east-1", cfg.AWSRegion)
	}
	if cfg.DynamoDBTablePrefix != "photo-gallery" {
		t.Errorf("DynamoDBTablePrefix = %v, want photo-gallery", cfg.DynamoDBTablePrefix)
	}
	if cfg.S3BucketOriginal != "original-bucket" {
		t.Errorf("S3BucketOriginal = %v, want original-bucket", cfg.S3BucketOriginal)
	}
}

func TestProcessorConfigBuilder_WithMethods(t *testing.T) {
	cfg, err := NewProcessorConfigBuilder().
		WithAWSRegion("eu-west-1").
		WithDynamoDBTablePrefix("test-prefix").
		WithS3Buckets("orig", "opt", "thumb").
		WithAPIStage("prod").
		Build()

	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	if cfg.AWSRegion != "eu-west-1" {
		t.Errorf("AWSRegion = %v, want eu-west-1", cfg.AWSRegion)
	}
	if cfg.S3BucketOptimized != "opt" {
		t.Errorf("S3BucketOptimized = %v, want opt", cfg.S3BucketOptimized)
	}
	if cfg.APIStage != "prod" {
		t.Errorf("APIStage = %v, want prod", cfg.APIStage)
	}
}

func TestProcessorConfigBuilder_ValidationErrors(t *testing.T) {
	_, err := NewProcessorConfigBuilder().Build()

	if err == nil {
		t.Fatal("Build() should have returned an error")
	}
	if !strings.Contains(err.Error(), "AWS_REGION_NAME is required") {
		t.Errorf("Error should mention AWS_REGION_NAME")
	}
	if !strings.Contains(err.Error(), "STAGE is required") {
		t.Errorf("Error should mention STAGE")
	}
}

func TestProcessorConfigBuilder_PartialConfig(t *testing.T) {
	_, err := NewProcessorConfigBuilder().
		WithAWSRegion("us-east-1").
		Build()

	if err == nil {
		t.Fatal("Build() should have returned an error for partial config")
	}
}

func TestProcessorConfig_TableNames(t *testing.T) {
	cfg := &ProcessorConfig{
		DynamoDBTablePrefix: "photo-gallery",
		APIStage:            "dev",
	}

	if cfg.PhotosTableName() != "photo-gallery-photos-dev" {
		t.Errorf("PhotosTableName() = %v, want photo-gallery-photos-dev", cfg.PhotosTableName())
	}
	if cfg.GalleriesTableName() != "photo-gallery-galleries-dev" {
		t.Errorf("GalleriesTableName() = %v, want photo-gallery-galleries-dev", cfg.GalleriesTableName())
	}
}
