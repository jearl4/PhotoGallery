package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"photographer-gallery/backend/internal/domain/gallery"
	dynamodbRepo "photographer-gallery/backend/internal/repository/dynamodb"
	"photographer-gallery/backend/internal/services/storage"
)

type SchedulerApp struct {
	galleryService *gallery.Service
}

func main() {
	app, err := initializeApp()
	if err != nil {
		log.Fatalf("Failed to initialize app: %v", err)
	}

	lambda.Start(app.handleScheduledEvent)
}

func initializeApp() (*SchedulerApp, error) {
	ctx := context.Background()

	// Load AWS config
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Initialize AWS clients
	dynamoClient := dynamodb.NewFromConfig(cfg)
	s3Client := s3.NewFromConfig(cfg)

	// Get environment variables
	tablePrefix := os.Getenv("DYNAMODB_TABLE_PREFIX")
	stage := os.Getenv("STAGE")
	originalBucket := os.Getenv("S3_BUCKET_ORIGINAL")
	optimizedBucket := os.Getenv("S3_BUCKET_OPTIMIZED")
	thumbnailBucket := os.Getenv("S3_BUCKET_THUMBNAIL")

	if tablePrefix == "" {
		tablePrefix = "photographer-gallery"
	}
	if stage == "" {
		stage = "dev"
	}

	// Initialize repositories
	galleriesTable := fmt.Sprintf("%s-galleries-%s", tablePrefix, stage)
	photosTable := fmt.Sprintf("%s-photos-%s", tablePrefix, stage)

	galleryRepo := dynamodbRepo.NewGalleryRepository(dynamoClient, galleriesTable)
	photoRepo := dynamodbRepo.NewPhotoRepository(dynamoClient, photosTable)

	// Initialize storage service
	presignExpiration := 15 * time.Minute
	storageService := storage.NewService(s3Client, originalBucket, optimizedBucket, thumbnailBucket, presignExpiration)

	// Initialize gallery service
	galleryService := gallery.NewService(galleryRepo, photoRepo, storageService)

	return &SchedulerApp{
		galleryService: galleryService,
	}, nil
}

// handleScheduledEvent is triggered daily by EventBridge to clean up expired galleries
func (app *SchedulerApp) handleScheduledEvent(ctx context.Context, event interface{}) error {
	log.Printf("Starting scheduled gallery cleanup task at %v", time.Now().UTC())

	// Process expired galleries (deletes galleries where expiresAt < now)
	if err := app.galleryService.ProcessExpiredGalleries(ctx, 100); err != nil {
		log.Printf("ERROR: Failed to process expired galleries: %v", err)
		return fmt.Errorf("failed to process expired galleries: %w", err)
	}

	log.Printf("Cleanup completed successfully at %v", time.Now().UTC())
	return nil
}
