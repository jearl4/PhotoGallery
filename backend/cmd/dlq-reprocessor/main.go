package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"

	"photographer-gallery/backend/internal/repository"
	dynamodbRepo "photographer-gallery/backend/internal/repository/dynamodb"
)

type Config struct {
	AWSRegion            string
	DynamoDBTablePrefix  string
	S3BucketOriginal     string
	S3BucketOptimized    string
	S3BucketThumbnail    string
	ProcessingQueueURL   string
	APIStage             string
}

// SQSAPI defines the SQS operations we need
type SQSAPI interface {
	SendMessage(ctx context.Context, params *sqs.SendMessageInput, optFns ...func(*sqs.Options)) (*sqs.SendMessageOutput, error)
}

type App struct {
	cfg       *Config
	sqsClient SQSAPI
	photoRepo repository.PhotoRepository
}

// RetryMetadata tracks retry attempts and delays
type RetryMetadata struct {
	AttemptNumber int       `json:"attemptNumber"`
	FirstFailedAt time.Time `json:"firstFailedAt"`
	LastRetryAt   time.Time `json:"lastRetryAt"`
	ErrorMessage  string    `json:"errorMessage"`
}

const (
	// Maximum number of retry attempts before marking as permanently failed
	maxRetryAttempts = 5

	// Base delay for exponential backoff (in seconds)
	baseDelaySeconds = 60
)

func main() {
	// Load configuration from environment variables
	cfg := &Config{
		AWSRegion:           os.Getenv("AWS_REGION_NAME"),
		DynamoDBTablePrefix: os.Getenv("DYNAMODB_TABLE_PREFIX"),
		S3BucketOriginal:    os.Getenv("S3_BUCKET_ORIGINAL"),
		S3BucketOptimized:   os.Getenv("S3_BUCKET_OPTIMIZED"),
		S3BucketThumbnail:   os.Getenv("S3_BUCKET_THUMBNAIL"),
		ProcessingQueueURL:  os.Getenv("PROCESSING_QUEUE_URL"),
		APIStage:            os.Getenv("STAGE"),
	}

	// Initialize AWS SDK
	awsCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(cfg.AWSRegion),
	)
	if err != nil {
		log.Fatalf("Failed to load AWS config: %v", err)
	}

	// Initialize clients
	sqsClient := sqs.NewFromConfig(awsCfg)
	dynamoClient := dynamodb.NewFromConfig(awsCfg)

	// Initialize repositories
	photoRepo := dynamodbRepo.NewPhotoRepository(
		dynamoClient,
		fmt.Sprintf("%s-photos-%s", cfg.DynamoDBTablePrefix, cfg.APIStage),
	)

	app := &App{
		cfg:       cfg,
		sqsClient: sqsClient,
		photoRepo: photoRepo,
	}

	lambda.Start(app.handleDLQEvent)
}

// handleDLQEvent processes messages from the Dead Letter Queue
func (app *App) handleDLQEvent(ctx context.Context, sqsEvent events.SQSEvent) error {
	log.Printf("Processing %d DLQ event records", len(sqsEvent.Records))

	for _, sqsRecord := range sqsEvent.Records {
		// Extract retry metadata from message attributes
		retryMetadata := app.extractRetryMetadata(sqsRecord)

		log.Printf("Processing DLQ message, attempt %d/%d", retryMetadata.AttemptNumber+1, maxRetryAttempts)

		// Check if we've exceeded max retry attempts
		if retryMetadata.AttemptNumber >= maxRetryAttempts {
			log.Printf("Max retry attempts reached for message. Marking as permanently failed.")
			if err := app.markAsPermantlyFailed(ctx, sqsRecord.Body, retryMetadata); err != nil {
				log.Printf("Failed to mark photo as permanently failed: %v", err)
			}
			continue
		}

		// Calculate exponential backoff delay
		delaySeconds := calculateBackoffDelay(retryMetadata.AttemptNumber)
		log.Printf("Scheduling retry with %d second delay (exponential backoff)", delaySeconds)

		// Update retry metadata
		retryMetadata.AttemptNumber++
		retryMetadata.LastRetryAt = time.Now()
		if retryMetadata.FirstFailedAt.IsZero() {
			retryMetadata.FirstFailedAt = time.Now()
		}

		// Re-queue the message with delay
		if err := app.requeueWithDelay(ctx, sqsRecord.Body, retryMetadata, delaySeconds); err != nil {
			log.Printf("Failed to requeue message: %v", err)
			continue
		}

		log.Printf("Successfully requeued message for retry")
	}

	return nil
}

// extractRetryMetadata extracts retry information from SQS message attributes
func (app *App) extractRetryMetadata(record events.SQSMessage) RetryMetadata {
	metadata := RetryMetadata{
		AttemptNumber: 0,
	}

	// Check for retry attempt count in message attributes
	if attemptAttr, ok := record.MessageAttributes["RetryAttempt"]; ok {
		if attemptAttr.StringValue != nil {
			if attempt, err := strconv.Atoi(*attemptAttr.StringValue); err == nil {
				metadata.AttemptNumber = attempt
			}
		}
	}

	// Check for first failed timestamp
	if firstFailedAttr, ok := record.MessageAttributes["FirstFailedAt"]; ok {
		if firstFailedAttr.StringValue != nil {
			if t, err := time.Parse(time.RFC3339, *firstFailedAttr.StringValue); err == nil {
				metadata.FirstFailedAt = t
			}
		}
	}

	// Check for last retry timestamp
	if lastRetryAttr, ok := record.MessageAttributes["LastRetryAt"]; ok {
		if lastRetryAttr.StringValue != nil {
			if t, err := time.Parse(time.RFC3339, *lastRetryAttr.StringValue); err == nil {
				metadata.LastRetryAt = t
			}
		}
	}

	// Check for error message
	if errorAttr, ok := record.MessageAttributes["ErrorMessage"]; ok {
		if errorAttr.StringValue != nil {
			metadata.ErrorMessage = *errorAttr.StringValue
		}
	}

	return metadata
}

// calculateBackoffDelay calculates exponential backoff delay
// Delays: 1min, 5min, 15min, 1hr, 4hr
func calculateBackoffDelay(attemptNumber int) int {
	delays := []int{
		60,        // 1 minute
		300,       // 5 minutes
		900,       // 15 minutes
		3600,      // 1 hour
		14400,     // 4 hours
	}

	if attemptNumber >= len(delays) {
		return delays[len(delays)-1]
	}

	return delays[attemptNumber]
}

// requeueWithDelay sends the message back to the processing queue with a delay
func (app *App) requeueWithDelay(ctx context.Context, messageBody string, metadata RetryMetadata, delaySeconds int) error {
	// Prepare message attributes with retry metadata
	messageAttributes := map[string]types.MessageAttributeValue{
		"RetryAttempt": {
			DataType:    aws.String("Number"),
			StringValue: aws.String(strconv.Itoa(metadata.AttemptNumber)),
		},
		"FirstFailedAt": {
			DataType:    aws.String("String"),
			StringValue: aws.String(metadata.FirstFailedAt.Format(time.RFC3339)),
		},
		"LastRetryAt": {
			DataType:    aws.String("String"),
			StringValue: aws.String(metadata.LastRetryAt.Format(time.RFC3339)),
		},
	}

	if metadata.ErrorMessage != "" {
		messageAttributes["ErrorMessage"] = types.MessageAttributeValue{
			DataType:    aws.String("String"),
			StringValue: aws.String(metadata.ErrorMessage),
		}
	}

	// Send message to processing queue with delay
	_, err := app.sqsClient.SendMessage(ctx, &sqs.SendMessageInput{
		QueueUrl:          aws.String(app.cfg.ProcessingQueueURL),
		MessageBody:       aws.String(messageBody),
		MessageAttributes: messageAttributes,
		DelaySeconds:      int32(delaySeconds),
	})

	return err
}

// markAsPermantlyFailed marks a photo as permanently failed after max retries
func (app *App) markAsPermantlyFailed(ctx context.Context, messageBody string, metadata RetryMetadata) error {
	// Parse S3 event from message body
	var s3Event events.S3Event
	if err := json.Unmarshal([]byte(messageBody), &s3Event); err != nil {
		return fmt.Errorf("failed to unmarshal S3 event: %w", err)
	}

	for _, record := range s3Event.Records {
		objectKey := record.S3.Object.Key

		// Extract photo ID from the object key
		photoID, err := extractPhotoID(objectKey)
		if err != nil {
			log.Printf("Failed to extract photo ID from key %s: %v", objectKey, err)
			continue
		}

		// Get photo from database
		photo, err := app.photoRepo.GetByID(ctx, photoID)
		if err != nil {
			log.Printf("Failed to get photo from database: %v", err)
			continue
		}

		if photo == nil {
			log.Printf("Photo not found in database: %s", photoID)
			continue
		}

		// Update photo status to permanently failed
		photo.ProcessingStatus = "failed_permanent"
		now := time.Now()
		photo.ProcessedAt = &now

		// Store failure metadata
		if photo.Metadata == nil {
			photo.Metadata = make(map[string]string)
		}
		photo.Metadata["failureReason"] = metadata.ErrorMessage
		photo.Metadata["failureAttempts"] = strconv.Itoa(metadata.AttemptNumber)
		photo.Metadata["firstFailedAt"] = metadata.FirstFailedAt.Format(time.RFC3339)
		photo.Metadata["lastRetryAt"] = metadata.LastRetryAt.Format(time.RFC3339)

		// Save updated photo
		if err := app.photoRepo.Update(ctx, photo); err != nil {
			log.Printf("Failed to update photo status: %v", err)
			continue
		}

		log.Printf("Marked photo %s as permanently failed after %d attempts", photoID, metadata.AttemptNumber)
	}

	return nil
}

// extractPhotoID extracts the photo ID from the S3 object key
// Expected format: {galleryID}/{photoID}/{filename}
func extractPhotoID(objectKey string) (string, error) {
	parts := strings.Split(objectKey, "/")
	if len(parts) < 3 {
		return "", fmt.Errorf("invalid object key format: %s", objectKey)
	}

	// The photoID is the second part: galleryID/photoID/filename
	photoID := parts[1]
	if !strings.HasPrefix(photoID, "photo_") {
		return "", fmt.Errorf("invalid photo ID format in key: %s", objectKey)
	}

	return photoID, nil
}
