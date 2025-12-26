package config

import (
	"fmt"
	"os"
)

// Config holds the application configuration
type Config struct {
	// AWS
	AWSRegion           string
	DynamoDBTablePrefix string
	S3BucketOriginal    string
	S3BucketOptimized   string
	S3BucketThumbnail   string
	CloudFrontDomain    string
	CloudFrontKeyPairID string
	CloudFrontKeyPath   string

	// Cognito
	CognitoUserPoolID     string
	CognitoClientID       string
	CognitoRegion         string

	// API
	APIStage       string
	AllowedOrigins string

	// Processing
	SQSQueueURL string

	// Session
	SessionTTLHours int

	// CloudFront signed URL expiration
	SignedURLExpiration int // hours
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		AWSRegion:           getEnv("AWS_REGION", "us-east-1"),
		DynamoDBTablePrefix: getEnv("DYNAMODB_TABLE_PREFIX", "photographer-gallery"),
		S3BucketOriginal:    getEnv("S3_BUCKET_ORIGINAL", ""),
		S3BucketOptimized:   getEnv("S3_BUCKET_OPTIMIZED", ""),
		S3BucketThumbnail:   getEnv("S3_BUCKET_THUMBNAIL", ""),
		CloudFrontDomain:    getEnv("CLOUDFRONT_DOMAIN", ""),
		CloudFrontKeyPairID: getEnv("CLOUDFRONT_KEY_PAIR_ID", ""),
		CloudFrontKeyPath:   getEnv("CLOUDFRONT_KEY_PATH", ""),
		CognitoUserPoolID:   getEnv("COGNITO_USER_POOL_ID", ""),
		CognitoClientID:     getEnv("COGNITO_CLIENT_ID", ""),
		CognitoRegion:       getEnv("COGNITO_REGION", "us-east-1"),
		APIStage:            getEnv("API_STAGE", "dev"),
		AllowedOrigins:      getEnv("ALLOWED_ORIGINS", "*"),
		SQSQueueURL:         getEnv("SQS_QUEUE_URL", ""),
		SessionTTLHours:     getEnvAsInt("SESSION_TTL_HOURS", 24),
		SignedURLExpiration: getEnvAsInt("SIGNED_URL_EXPIRATION", 24),
	}
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}
	// Simple conversion, in production use strconv.Atoi with error handling
	value := defaultValue
	_, _ = fmt.Sscanf(valueStr, "%d", &value)
	return value
}
