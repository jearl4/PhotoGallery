package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	imageType "image"
	"io"
	"log"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/disintegration/imaging"

	appconfig "photographer-gallery/backend/internal/config"
	"photographer-gallery/backend/internal/repository"
	dynamodbRepo "photographer-gallery/backend/internal/repository/dynamodb"
	"photographer-gallery/backend/internal/services/image"
	"photographer-gallery/backend/pkg/utils/s3key"
)

// S3API defines the S3 operations we need
type S3API interface {
	GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error)
	PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error)
}

// App holds application dependencies.
type App struct {
	cfg         *appconfig.ProcessorConfig
	s3Client    S3API
	photoRepo   repository.PhotoRepository
	galleryRepo repository.GalleryRepository
	processor   *image.Processor
}

func main() {
	app, err := initApp()
	if err != nil {
		log.Fatalf("Failed to initialize: %v", err)
	}
	lambda.Start(app.handleS3Event)
}

func initApp() (*App, error) {
	cfg, err := appconfig.NewProcessorConfigBuilder().FromEnvironment().Build()
	if err != nil {
		return nil, err
	}

	awsCfg, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(cfg.AWSRegion))
	if err != nil {
		return nil, err
	}

	return &App{
		cfg:         cfg,
		s3Client:    s3.NewFromConfig(awsCfg),
		photoRepo:   dynamodbRepo.NewPhotoRepository(dynamodb.NewFromConfig(awsCfg), cfg.PhotosTableName()),
		galleryRepo: dynamodbRepo.NewGalleryRepository(dynamodb.NewFromConfig(awsCfg), cfg.GalleriesTableName()),
		processor:   image.NewProcessor(),
	}, nil
}

// handleS3Event processes S3 events when a photo is uploaded.
func (app *App) handleS3Event(ctx context.Context, sqsEvent events.SQSEvent) error {
	log.Printf("Processing %d SQS records", len(sqsEvent.Records))

	for _, sqsRecord := range sqsEvent.Records {
		var s3Event events.S3Event
		if err := json.Unmarshal([]byte(sqsRecord.Body), &s3Event); err != nil {
			log.Printf("Failed to unmarshal S3 event: %v", err)
			continue
		}

		for _, record := range s3Event.Records {
			bucket, key := record.S3.Bucket.Name, record.S3.Object.Key
			log.Printf("Processing: %s/%s", bucket, key)

			parsed, err := s3key.Parse(key)
			if err != nil {
				log.Printf("Invalid key %s: %v", key, err)
				continue
			}

			if err := app.processPhoto(ctx, parsed, bucket, key); err != nil {
				log.Printf("Failed to process %s: %v", parsed.PhotoID, err)
				app.updatePhotoStatus(ctx, parsed.PhotoID, "failed")
				continue
			}
			log.Printf("Processed photo %s", parsed.PhotoID)
		}
	}
	return nil
}

// processPhoto downloads, processes, and stores the photo.
func (app *App) processPhoto(ctx context.Context, key *s3key.Key, bucket, objectKey string) error {
	// Download from S3
	imageData, contentLength, err := app.downloadImage(ctx, bucket, objectKey)
	if err != nil {
		return err
	}

	// Get dimensions and metadata
	width, height, _ := app.processor.GetImageDimensions(bytes.NewReader(imageData))
	metadata, _ := app.processor.ExtractEXIF(bytes.NewReader(imageData))
	if metadata == nil {
		metadata = &image.ImageMetadata{}
	}
	if metadata.Width == 0 {
		metadata.Width = width
	}
	if metadata.Height == 0 {
		metadata.Height = height
	}

	// Fetch gallery for watermark settings
	gallery, _ := app.galleryRepo.GetByID(ctx, key.GalleryID)

	// Generate and upload thumbnail
	thumbnailData, err := app.processor.GenerateThumbnail(bytes.NewReader(imageData))
	if err != nil {
		return fmt.Errorf("thumbnail generation failed: %w", err)
	}
	thumbnailKey := s3key.ChangeExtension(objectKey, ".jpg")
	if err := app.uploadToS3(ctx, app.cfg.S3BucketThumbnail, thumbnailKey, thumbnailData, "image/jpeg"); err != nil {
		return fmt.Errorf("thumbnail upload failed: %w", err)
	}

	// Generate and upload optimized version
	optimizedData, err := app.generateOptimized(bytes.NewReader(imageData), gallery)
	if err != nil {
		return fmt.Errorf("optimization failed: %w", err)
	}
	optimizedKey := s3key.ChangeExtension(objectKey, ".jpg")
	if err := app.uploadToS3(ctx, app.cfg.S3BucketOptimized, optimizedKey, optimizedData, "image/jpeg"); err != nil {
		return fmt.Errorf("optimized upload failed: %w", err)
	}

	// Update database
	return app.updatePhotoRecord(ctx, key, objectKey, thumbnailKey, optimizedKey, metadata, contentLength)
}

func (app *App) downloadImage(ctx context.Context, bucket, key string) ([]byte, int64, error) {
	output, err := app.s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, 0, fmt.Errorf("S3 download failed: %w", err)
	}
	defer output.Body.Close()

	data, err := io.ReadAll(output.Body)
	if err != nil {
		return nil, 0, fmt.Errorf("read failed: %w", err)
	}

	var size int64
	if output.ContentLength != nil {
		size = *output.ContentLength
	}
	return data, size, nil
}

func (app *App) updatePhotoRecord(ctx context.Context, key *s3key.Key, objectKey, thumbnailKey, optimizedKey string, metadata *image.ImageMetadata, size int64) error {
	photo, _ := app.photoRepo.GetByID(ctx, key.PhotoID)
	isNew := photo == nil

	if isNew {
		now := time.Now()
		photo = &repository.Photo{
			PhotoID:          key.PhotoID,
			GalleryID:        key.GalleryID,
			FileName:         key.FileName,
			OriginalKey:      objectKey,
			MimeType:         s3key.GetMimeType(key.Extension),
			Size:             size,
			Width:            metadata.Width,
			Height:           metadata.Height,
			UploadedAt:       now,
			ProcessingStatus: "processing",
			Metadata:         make(map[string]string),
		}
		if err := app.photoRepo.Create(ctx, photo); err != nil {
			return fmt.Errorf("create photo failed: %w", err)
		}
	}

	// Update with processing results
	photo.OptimizedKey = optimizedKey
	photo.ThumbnailKey = thumbnailKey
	photo.Width = metadata.Width
	photo.Height = metadata.Height
	photo.ProcessingStatus = "completed"
	now := time.Now()
	photo.ProcessedAt = &now
	app.storeEXIFMetadata(photo, metadata)

	if err := app.photoRepo.Update(ctx, photo); err != nil {
		return fmt.Errorf("update photo failed: %w", err)
	}

	if isNew {
		app.galleryRepo.UpdatePhotoCount(ctx, key.GalleryID, 1)
		app.galleryRepo.UpdateTotalSize(ctx, key.GalleryID, size)
	}
	return nil
}

func (app *App) storeEXIFMetadata(photo *repository.Photo, m *image.ImageMetadata) {
	if photo.Metadata == nil {
		photo.Metadata = make(map[string]string)
	}
	if m.CameraModel != "" {
		photo.Metadata["cameraModel"] = m.CameraModel
	}
	if m.DateTaken != "" {
		photo.Metadata["dateTaken"] = m.DateTaken
	}
	if m.ISO > 0 {
		photo.Metadata["iso"] = fmt.Sprintf("%d", m.ISO)
	}
	if m.Aperture != "" {
		photo.Metadata["aperture"] = m.Aperture
	}
	if m.ShutterSpeed != "" {
		photo.Metadata["shutterSpeed"] = m.ShutterSpeed
	}
	if m.FocalLength != "" {
		photo.Metadata["focalLength"] = m.FocalLength
	}
	if m.GPS != nil {
		gpsData, _ := json.Marshal(m.GPS)
		photo.Metadata["gps"] = string(gpsData)
	}
}

func (app *App) uploadToS3(ctx context.Context, bucket, key string, data []byte, contentType string) error {
	_, err := app.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})
	return err
}

func (app *App) updatePhotoStatus(ctx context.Context, photoID, status string) {
	photo, err := app.photoRepo.GetByID(ctx, photoID)
	if err != nil || photo == nil {
		return
	}
	photo.ProcessingStatus = status
	if status == "completed" || status == "failed" {
		now := time.Now()
		photo.ProcessedAt = &now
	}
	app.photoRepo.Update(ctx, photo)
}

func (app *App) generateOptimized(imageData io.Reader, gallery *repository.Gallery) ([]byte, error) {
	img, _, err := imageType.Decode(imageData)
	if err != nil {
		return nil, fmt.Errorf("decode failed: %w", err)
	}

	bounds := img.Bounds()
	var result imageType.Image = img
	if bounds.Dx() > image.OptimizedMaxWidth || bounds.Dy() > image.OptimizedMaxHeight {
		result = imaging.Fit(img, image.OptimizedMaxWidth, image.OptimizedMaxHeight, imaging.Lanczos)
	}

	if gallery != nil && gallery.EnableWatermark && gallery.WatermarkText != "" {
		position := gallery.WatermarkPosition
		if position == "" {
			position = "bottom-right"
		}
		result = app.processor.ApplyWatermark(result, image.WatermarkOptions{
			Text:     gallery.WatermarkText,
			Position: position,
		})
	}

	var buf bytes.Buffer
	if err := imaging.Encode(&buf, result, imaging.JPEG); err != nil {
		return nil, fmt.Errorf("encode failed: %w", err)
	}
	return buf.Bytes(), nil
}
