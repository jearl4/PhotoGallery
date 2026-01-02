package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	imageType "image"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/disintegration/imaging"

	"photographer-gallery/backend/internal/repository"
	dynamodbRepo "photographer-gallery/backend/internal/repository/dynamodb"
	"photographer-gallery/backend/internal/services/image"
)

type Config struct {
	AWSRegion            string
	DynamoDBTablePrefix  string
	S3BucketOriginal     string
	S3BucketOptimized    string
	S3BucketThumbnail    string
	APIStage             string
}

// S3API defines the S3 operations we need
type S3API interface {
	GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error)
	PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error)
}

type App struct {
	cfg           *Config
	s3Client      S3API
	photoRepo     repository.PhotoRepository
	galleryRepo   repository.GalleryRepository
	processor     *image.Processor
}

func main() {
	// Load configuration from environment variables
	cfg := &Config{
		AWSRegion:           os.Getenv("AWS_REGION_NAME"),
		DynamoDBTablePrefix: os.Getenv("DYNAMODB_TABLE_PREFIX"),
		S3BucketOriginal:    os.Getenv("S3_BUCKET_ORIGINAL"),
		S3BucketOptimized:   os.Getenv("S3_BUCKET_OPTIMIZED"),
		S3BucketThumbnail:   os.Getenv("S3_BUCKET_THUMBNAIL"),
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
	s3Client := s3.NewFromConfig(awsCfg)
	dynamoClient := dynamodb.NewFromConfig(awsCfg)

	// Initialize repositories
	photoRepo := dynamodbRepo.NewPhotoRepository(
		dynamoClient,
		fmt.Sprintf("%s-photos-%s", cfg.DynamoDBTablePrefix, cfg.APIStage),
	)
	galleryRepo := dynamodbRepo.NewGalleryRepository(
		dynamoClient,
		fmt.Sprintf("%s-galleries-%s", cfg.DynamoDBTablePrefix, cfg.APIStage),
	)

	// Initialize image processor
	processor := image.NewProcessor()

	app := &App{
		cfg:         cfg,
		s3Client:    s3Client,
		photoRepo:   photoRepo,
		galleryRepo: galleryRepo,
		processor:   processor,
	}

	lambda.Start(app.handleS3Event)
}

// handleS3Event processes S3 events when a photo is uploaded
func (app *App) handleS3Event(ctx context.Context, sqsEvent events.SQSEvent) error {
	log.Printf("Processing %d SQS event records", len(sqsEvent.Records))

	for _, sqsRecord := range sqsEvent.Records {
		// Parse S3 event from SQS message body
		var s3Event events.S3Event
		if err := json.Unmarshal([]byte(sqsRecord.Body), &s3Event); err != nil {
			log.Printf("Failed to unmarshal S3 event: %v", err)
			continue
		}

		for _, record := range s3Event.Records {
			s3Entity := record.S3
			bucketName := s3Entity.Bucket.Name
			objectKey := s3Entity.Object.Key

			log.Printf("Processing object: %s/%s", bucketName, objectKey)

			// Extract photo ID from the object key
			photoID, err := extractPhotoID(objectKey)
			if err != nil {
				log.Printf("Failed to extract photo ID from key %s: %v", objectKey, err)
				continue
			}

			// Process the photo
			if err := app.processPhoto(ctx, photoID, bucketName, objectKey); err != nil {
				log.Printf("Failed to process photo %s: %v", photoID, err)

				// Update photo status to failed
				if updateErr := app.updatePhotoStatus(ctx, photoID, "failed"); updateErr != nil {
					log.Printf("Failed to update photo status to failed: %v", updateErr)
				}

				continue
			}

			log.Printf("Successfully processed photo %s", photoID)
		}
	}

	return nil
}

// processPhoto downloads the original photo, generates thumbnails and optimized versions
func (app *App) processPhoto(ctx context.Context, photoID, bucketName, objectKey string) error {
	// Download the original photo from S3
	log.Printf("Downloading original photo from S3: %s/%s", bucketName, objectKey)
	getObjectOutput, err := app.s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(objectKey),
	})
	if err != nil {
		return fmt.Errorf("failed to download photo from S3: %w", err)
	}
	defer getObjectOutput.Body.Close()

	// Read the entire image into memory
	imageData, err := io.ReadAll(getObjectOutput.Body)
	if err != nil {
		return fmt.Errorf("failed to read image data: %w", err)
	}

	// Get image dimensions
	width, height, err := app.processor.GetImageDimensions(bytes.NewReader(imageData))
	if err != nil {
		return fmt.Errorf("failed to get image dimensions: %w", err)
	}

	// Extract gallery ID from object key to fetch gallery settings
	galleryID, err := extractGalleryID(objectKey)
	if err != nil {
		return fmt.Errorf("failed to extract gallery ID from key %s: %w", objectKey, err)
	}

	// Fetch gallery settings to check if watermarking is enabled
	gallery, err := app.galleryRepo.GetByID(ctx, galleryID)
	if err != nil {
		log.Printf("Warning: Failed to fetch gallery settings: %v", err)
		gallery = nil // Continue without watermark
	}

	// Extract EXIF metadata
	log.Printf("Extracting EXIF metadata for photo %s", photoID)
	metadata, err := app.processor.ExtractEXIF(bytes.NewReader(imageData))
	if err != nil {
		log.Printf("Warning: Failed to extract EXIF: %v", err)
		metadata = &image.ImageMetadata{}
	}

	// Update width and height if not already set
	if metadata.Width == 0 {
		metadata.Width = width
	}
	if metadata.Height == 0 {
		metadata.Height = height
	}

	// Generate thumbnail
	log.Printf("Generating thumbnail for photo %s", photoID)
	thumbnailData, err := app.processor.GenerateThumbnail(bytes.NewReader(imageData))
	if err != nil {
		return fmt.Errorf("failed to generate thumbnail: %w", err)
	}

	// Upload thumbnail to S3
	// Use the same key structure but change extension to .jpg for processed images
	thumbnailKey := changeExtension(objectKey, ".jpg")
	if err := app.uploadToS3(ctx, app.cfg.S3BucketThumbnail, thumbnailKey, thumbnailData, "image/jpeg"); err != nil {
		return fmt.Errorf("failed to upload thumbnail: %w", err)
	}

	// Generate optimized version with optional watermark
	log.Printf("Generating optimized version for photo %s", photoID)
	optimizedData, err := app.generateOptimizedWithWatermark(bytes.NewReader(imageData), gallery)
	if err != nil {
		return fmt.Errorf("failed to generate optimized version: %w", err)
	}

	// Upload optimized version to S3
	// Use the same key structure but change extension to .jpg for processed images
	optimizedKey := changeExtension(objectKey, ".jpg")
	if err := app.uploadToS3(ctx, app.cfg.S3BucketOptimized, optimizedKey, optimizedData, "image/jpeg"); err != nil {
		return fmt.Errorf("failed to upload optimized version: %w", err)
	}

	// WebP conversion skipped - not currently supported (requires CGO)
	// Can be re-enabled later with pure Go library or CGO-enabled build
	log.Printf("WebP conversion skipped for photo %s (not currently supported)", photoID)

	// Get or create photo record in DynamoDB
	photo, err := app.photoRepo.GetByID(ctx, photoID)
	if err != nil {
		return fmt.Errorf("failed to get photo from database: %w", err)
	}

	// Track if this is a new photo for gallery count update
	isNewPhoto := (photo == nil)

	// If photo doesn't exist, create it
	if photo == nil {
		// Extract gallery ID and filename from object key
		// Format: {galleryID}/{photoID}/{filename}
		parts := strings.Split(objectKey, "/")
		if len(parts) < 3 {
			return fmt.Errorf("invalid object key format: %s", objectKey)
		}

		galleryID := parts[0]
		fileName := parts[2]

		// Determine mime type from file extension
		mimeType := "image/jpeg"
		if strings.HasSuffix(strings.ToLower(fileName), ".png") {
			mimeType = "image/png"
		} else if strings.HasSuffix(strings.ToLower(fileName), ".webp") {
			mimeType = "image/webp"
		}

		// Get file size
		var size int64
		if getObjectOutput.ContentLength != nil {
			size = *getObjectOutput.ContentLength
		}

		now := time.Now()
		photo = &repository.Photo{
			PhotoID:          photoID,
			GalleryID:        galleryID,
			FileName:         fileName,
			OriginalKey:      objectKey,
			MimeType:         mimeType,
			Size:             size,
			Width:            metadata.Width,
			Height:           metadata.Height,
			UploadedAt:       now,
			ProcessingStatus: "processing",
			FavoriteCount:    0,
			DownloadCount:    0,
			Metadata:         make(map[string]string),
		}

		if err := app.photoRepo.Create(ctx, photo); err != nil {
			return fmt.Errorf("failed to create photo in database: %w", err)
		}

		log.Printf("Created photo record for %s", photoID)
	}

	// Update photo with processing results
	photo.OptimizedKey = optimizedKey
	photo.ThumbnailKey = thumbnailKey
	photo.Width = metadata.Width
	photo.Height = metadata.Height
	photo.ProcessingStatus = "completed"
	now := time.Now()
	photo.ProcessedAt = &now

	// Store EXIF metadata
	if photo.Metadata == nil {
		photo.Metadata = make(map[string]string)
	}
	if metadata.CameraModel != "" {
		photo.Metadata["cameraModel"] = metadata.CameraModel
	}
	if metadata.DateTaken != "" {
		photo.Metadata["dateTaken"] = metadata.DateTaken
	}
	if metadata.ISO > 0 {
		photo.Metadata["iso"] = fmt.Sprintf("%d", metadata.ISO)
	}
	if metadata.Aperture != "" {
		photo.Metadata["aperture"] = metadata.Aperture
	}
	if metadata.ShutterSpeed != "" {
		photo.Metadata["shutterSpeed"] = metadata.ShutterSpeed
	}
	if metadata.FocalLength != "" {
		photo.Metadata["focalLength"] = metadata.FocalLength
	}
	if metadata.GPS != nil {
		gpsData, _ := json.Marshal(metadata.GPS)
		photo.Metadata["gps"] = string(gpsData)
	}

	// Save updated photo
	if err := app.photoRepo.Update(ctx, photo); err != nil {
		return fmt.Errorf("failed to update photo in database: %w", err)
	}

	// Update gallery photo count (only if this is a new photo)
	if isNewPhoto {
		log.Printf("Updating gallery photo count for gallery %s", photo.GalleryID)
		if err := app.galleryRepo.UpdatePhotoCount(ctx, photo.GalleryID, 1); err != nil {
			log.Printf("Warning: Failed to update gallery photo count: %v", err)
			// Don't fail the entire process if photo count update fails
		}

		// Also update total size
		log.Printf("Updating gallery total size for gallery %s (adding %d bytes)", photo.GalleryID, photo.Size)
		if err := app.galleryRepo.UpdateTotalSize(ctx, photo.GalleryID, photo.Size); err != nil {
			log.Printf("Warning: Failed to update gallery total size: %v", err)
		}
	}

	log.Printf("Photo %s processed successfully", photoID)
	return nil
}

// uploadToS3 uploads data to S3
func (app *App) uploadToS3(ctx context.Context, bucket, key string, data []byte, contentType string) error {
	log.Printf("Uploading to S3: %s/%s (%d bytes)", bucket, key, len(data))

	_, err := app.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})

	return err
}

// updatePhotoStatus updates the processing status of a photo
func (app *App) updatePhotoStatus(ctx context.Context, photoID, status string) error {
	photo, err := app.photoRepo.GetByID(ctx, photoID)
	if err != nil {
		return err
	}
	if photo == nil {
		return fmt.Errorf("photo not found: %s", photoID)
	}

	photo.ProcessingStatus = status
	if status == "completed" || status == "failed" {
		now := time.Now()
		photo.ProcessedAt = &now
	}

	return app.photoRepo.Update(ctx, photo)
}

// extractPhotoID extracts the photo ID and gallery ID from the S3 object key
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

// extractGalleryID extracts the gallery ID from the S3 object key
// Expected format: {galleryID}/{photoID}/{filename}
func extractGalleryID(objectKey string) (string, error) {
	parts := strings.Split(objectKey, "/")
	if len(parts) < 3 {
		return "", fmt.Errorf("invalid object key format: %s", objectKey)
	}

	// The galleryID is the first part: galleryID/photoID/filename
	galleryID := parts[0]
	if !strings.HasPrefix(galleryID, "gal_") {
		return "", fmt.Errorf("invalid gallery ID format in key: %s", objectKey)
	}

	return galleryID, nil
}

// generateOptimizedWithWatermark generates an optimized image with optional watermark
func (app *App) generateOptimizedWithWatermark(imageData io.Reader, gallery *repository.Gallery) ([]byte, error) {
	// Decode the image
	img, format, err := imageType.Decode(imageData)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	log.Printf("Decoded image format: %s", format)

	// Get original dimensions
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// Only resize if image is larger than max dimensions
	var resized imageType.Image
	if width > image.OptimizedMaxWidth || height > image.OptimizedMaxHeight {
		resized = imaging.Fit(img, image.OptimizedMaxWidth, image.OptimizedMaxHeight, imaging.Lanczos)
	} else {
		resized = img
	}

	// Apply watermark if enabled for this gallery
	var final imageType.Image = resized
	if gallery != nil && gallery.EnableWatermark && gallery.WatermarkText != "" {
		log.Printf("Applying watermark to image: %s", gallery.WatermarkText)
		position := gallery.WatermarkPosition
		if position == "" {
			position = "bottom-right"
		}
		final = app.processor.ApplyWatermark(resized, image.WatermarkOptions{
			Text:     gallery.WatermarkText,
			Position: position,
		})
	}

	// Encode to JPEG
	var buf bytes.Buffer
	if err := imaging.Encode(&buf, final, imaging.JPEG); err != nil {
		return nil, fmt.Errorf("failed to encode optimized image: %w", err)
	}

	return buf.Bytes(), nil
}

// changeExtension changes the file extension of a key
func changeExtension(key, newExt string) string {
	lastDot := strings.LastIndex(key, ".")
	if lastDot == -1 {
		return key + newExt
	}
	return key[:lastDot] + newExt
}
