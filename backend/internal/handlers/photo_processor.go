// Package handlers provides HTTP handlers and processing pipelines.
package handlers

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"

	"photographer-gallery/backend/internal/repository"
	"photographer-gallery/backend/internal/services/image"
	"photographer-gallery/backend/pkg/utils/s3key"
)

// ProcessingContext holds all data needed during photo processing.
type ProcessingContext struct {
	ctx           context.Context
	PhotoID       string
	GalleryID     string
	ObjectKey     string
	BucketName    string
	ImageData     []byte
	Metadata      *image.ImageMetadata
	Gallery       *repository.Gallery
	Photo         *repository.Photo
	ThumbnailData []byte
	OptimizedData []byte
	Width         int
	Height        int
}

// NewProcessingContext creates a new processing context.
func NewProcessingContext(ctx context.Context, photoID, galleryID, objectKey, bucketName string) *ProcessingContext {
	return &ProcessingContext{
		ctx:        ctx,
		PhotoID:    photoID,
		GalleryID:  galleryID,
		ObjectKey:  objectKey,
		BucketName: bucketName,
	}
}

// ProcessingHandler defines the interface for chain of responsibility handlers.
type ProcessingHandler interface {
	SetNext(handler ProcessingHandler) ProcessingHandler
	Handle(pctx *ProcessingContext) error
}

// BaseHandler provides the base implementation for the chain.
type BaseHandler struct {
	next ProcessingHandler
}

// SetNext sets the next handler in the chain and returns it for fluent chaining.
func (h *BaseHandler) SetNext(handler ProcessingHandler) ProcessingHandler {
	h.next = handler
	return handler
}

// HandleNext passes processing to the next handler if it exists.
func (h *BaseHandler) HandleNext(pctx *ProcessingContext) error {
	if h.next != nil {
		return h.next.Handle(pctx)
	}
	return nil
}

// S3Downloader defines the interface for downloading from S3.
type S3Downloader interface {
	Download(ctx context.Context, bucket, key string) (io.ReadCloser, error)
}

// S3Uploader defines the interface for uploading to S3.
type S3Uploader interface {
	Upload(ctx context.Context, bucket, key string, data []byte, contentType string) error
}

// DownloadHandler downloads the original image from S3.
type DownloadHandler struct {
	BaseHandler
	s3Client S3Downloader
}

// NewDownloadHandler creates a new download handler.
func NewDownloadHandler(s3Client S3Downloader) *DownloadHandler {
	return &DownloadHandler{s3Client: s3Client}
}

// Handle downloads the image from S3.
func (h *DownloadHandler) Handle(pctx *ProcessingContext) error {
	log.Printf("[DownloadHandler] Downloading from %s/%s", pctx.BucketName, pctx.ObjectKey)

	reader, err := h.s3Client.Download(pctx.ctx, pctx.BucketName, pctx.ObjectKey)
	if err != nil {
		return fmt.Errorf("failed to download image: %w", err)
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		return fmt.Errorf("failed to read image data: %w", err)
	}

	pctx.ImageData = data
	return h.HandleNext(pctx)
}

// DimensionsHandler extracts image dimensions.
type DimensionsHandler struct {
	BaseHandler
	processor *image.Processor
}

// NewDimensionsHandler creates a new dimensions handler.
func NewDimensionsHandler(processor *image.Processor) *DimensionsHandler {
	return &DimensionsHandler{processor: processor}
}

// Handle extracts dimensions from the image.
func (h *DimensionsHandler) Handle(pctx *ProcessingContext) error {
	log.Printf("[DimensionsHandler] Extracting dimensions for photo %s", pctx.PhotoID)

	width, height, err := h.processor.GetImageDimensions(bytes.NewReader(pctx.ImageData))
	if err != nil {
		return fmt.Errorf("failed to get dimensions: %w", err)
	}

	pctx.Width = width
	pctx.Height = height
	return h.HandleNext(pctx)
}

// MetadataHandler extracts EXIF metadata.
type MetadataHandler struct {
	BaseHandler
	processor *image.Processor
}

// NewMetadataHandler creates a new metadata handler.
func NewMetadataHandler(processor *image.Processor) *MetadataHandler {
	return &MetadataHandler{processor: processor}
}

// Handle extracts EXIF metadata from the image.
func (h *MetadataHandler) Handle(pctx *ProcessingContext) error {
	log.Printf("[MetadataHandler] Extracting metadata for photo %s", pctx.PhotoID)

	metadata, err := h.processor.ExtractEXIF(bytes.NewReader(pctx.ImageData))
	if err != nil {
		log.Printf("[MetadataHandler] Warning: Failed to extract EXIF: %v", err)
		pctx.Metadata = &image.ImageMetadata{}
	} else {
		pctx.Metadata = metadata
	}

	// Update dimensions if not set from EXIF
	if pctx.Metadata.Width == 0 {
		pctx.Metadata.Width = pctx.Width
	}
	if pctx.Metadata.Height == 0 {
		pctx.Metadata.Height = pctx.Height
	}

	return h.HandleNext(pctx)
}

// ThumbnailHandler generates a thumbnail.
type ThumbnailHandler struct {
	BaseHandler
	processor *image.Processor
}

// NewThumbnailHandler creates a new thumbnail handler.
func NewThumbnailHandler(processor *image.Processor) *ThumbnailHandler {
	return &ThumbnailHandler{processor: processor}
}

// Handle generates a thumbnail image.
func (h *ThumbnailHandler) Handle(pctx *ProcessingContext) error {
	log.Printf("[ThumbnailHandler] Generating thumbnail for photo %s", pctx.PhotoID)

	data, err := h.processor.GenerateThumbnail(bytes.NewReader(pctx.ImageData))
	if err != nil {
		return fmt.Errorf("failed to generate thumbnail: %w", err)
	}

	pctx.ThumbnailData = data
	return h.HandleNext(pctx)
}

// OptimizedHandler generates an optimized version with optional watermark.
type OptimizedHandler struct {
	BaseHandler
	processor *image.Processor
}

// NewOptimizedHandler creates a new optimized handler.
func NewOptimizedHandler(processor *image.Processor) *OptimizedHandler {
	return &OptimizedHandler{processor: processor}
}

// Handle generates an optimized version of the image.
func (h *OptimizedHandler) Handle(pctx *ProcessingContext) error {
	log.Printf("[OptimizedHandler] Generating optimized version for photo %s", pctx.PhotoID)

	// Build processing strategy chain
	strategies := []image.ProcessingStrategy{
		image.NewResizeStrategy(),
	}

	// Add watermark if gallery has watermark enabled
	if pctx.Gallery != nil && pctx.Gallery.EnableWatermark && pctx.Gallery.WatermarkText != "" {
		position := pctx.Gallery.WatermarkPosition
		if position == "" {
			position = "bottom-right"
		}
		strategies = append(strategies, image.NewWatermarkStrategy(pctx.Gallery.WatermarkText, position))
	}

	// Process using strategy chain
	processor := image.NewImageProcessor(image.NewJPEGEncoder(85))
	data, err := processor.ProcessWithChain(bytes.NewReader(pctx.ImageData), strategies...)
	if err != nil {
		return fmt.Errorf("failed to generate optimized: %w", err)
	}

	pctx.OptimizedData = data
	return h.HandleNext(pctx)
}

// UploadHandler uploads processed images to S3.
type UploadHandler struct {
	BaseHandler
	s3Client       S3Uploader
	thumbnailBucket string
	optimizedBucket string
}

// NewUploadHandler creates a new upload handler.
func NewUploadHandler(s3Client S3Uploader, thumbnailBucket, optimizedBucket string) *UploadHandler {
	return &UploadHandler{
		s3Client:        s3Client,
		thumbnailBucket: thumbnailBucket,
		optimizedBucket: optimizedBucket,
	}
}

// Handle uploads thumbnail and optimized images to S3.
func (h *UploadHandler) Handle(pctx *ProcessingContext) error {
	thumbnailKey := s3key.ChangeExtension(pctx.ObjectKey, ".jpg")
	optimizedKey := s3key.ChangeExtension(pctx.ObjectKey, ".jpg")

	// Upload thumbnail
	log.Printf("[UploadHandler] Uploading thumbnail to %s/%s", h.thumbnailBucket, thumbnailKey)
	if err := h.s3Client.Upload(pctx.ctx, h.thumbnailBucket, thumbnailKey, pctx.ThumbnailData, "image/jpeg"); err != nil {
		return fmt.Errorf("failed to upload thumbnail: %w", err)
	}

	// Upload optimized
	log.Printf("[UploadHandler] Uploading optimized to %s/%s", h.optimizedBucket, optimizedKey)
	if err := h.s3Client.Upload(pctx.ctx, h.optimizedBucket, optimizedKey, pctx.OptimizedData, "image/jpeg"); err != nil {
		return fmt.Errorf("failed to upload optimized: %w", err)
	}

	return h.HandleNext(pctx)
}

// DatabaseUpdateHandler updates the photo record in the database.
type DatabaseUpdateHandler struct {
	BaseHandler
	photoRepo   repository.PhotoRepository
	galleryRepo repository.GalleryRepository
}

// NewDatabaseUpdateHandler creates a new database update handler.
func NewDatabaseUpdateHandler(photoRepo repository.PhotoRepository, galleryRepo repository.GalleryRepository) *DatabaseUpdateHandler {
	return &DatabaseUpdateHandler{
		photoRepo:   photoRepo,
		galleryRepo: galleryRepo,
	}
}

// Handle updates the database with processed photo information.
func (h *DatabaseUpdateHandler) Handle(pctx *ProcessingContext) error {
	log.Printf("[DatabaseUpdateHandler] Updating database for photo %s", pctx.PhotoID)

	// Get or create photo record
	photo, err := h.photoRepo.GetByID(pctx.ctx, pctx.PhotoID)
	if err != nil {
		return fmt.Errorf("failed to get photo: %w", err)
	}

	if photo == nil {
		// Create new photo record
		key, _ := s3key.Parse(pctx.ObjectKey)
		photo = &repository.Photo{
			PhotoID:          pctx.PhotoID,
			GalleryID:        pctx.GalleryID,
			FileName:         key.FileName,
			OriginalKey:      pctx.ObjectKey,
			OptimizedKey:     s3key.ChangeExtension(pctx.ObjectKey, ".jpg"),
			ThumbnailKey:     s3key.ChangeExtension(pctx.ObjectKey, ".jpg"),
			MimeType:         s3key.GetMimeType(key.Extension),
			Size:             int64(len(pctx.ImageData)),
			Width:            pctx.Width,
			Height:           pctx.Height,
			ProcessingStatus: "completed",
		}

		if err := h.photoRepo.Create(pctx.ctx, photo); err != nil {
			return fmt.Errorf("failed to create photo: %w", err)
		}

		// Update gallery photo count
		if err := h.galleryRepo.UpdatePhotoCount(pctx.ctx, pctx.GalleryID, 1); err != nil {
			log.Printf("[DatabaseUpdateHandler] Warning: Failed to update photo count: %v", err)
		}
	} else {
		// Update existing photo
		photo.ProcessingStatus = "completed"
		photo.Width = pctx.Width
		photo.Height = pctx.Height
		photo.OptimizedKey = s3key.ChangeExtension(pctx.ObjectKey, ".jpg")
		photo.ThumbnailKey = s3key.ChangeExtension(pctx.ObjectKey, ".jpg")

		if err := h.photoRepo.Update(pctx.ctx, photo); err != nil {
			return fmt.Errorf("failed to update photo: %w", err)
		}
	}

	pctx.Photo = photo
	return h.HandleNext(pctx)
}

// ProcessingPipeline builds the complete photo processing chain.
type ProcessingPipeline struct {
	firstHandler ProcessingHandler
}

// NewProcessingPipeline creates a new processing pipeline with all handlers.
func NewProcessingPipeline(
	s3Downloader S3Downloader,
	s3Uploader S3Uploader,
	processor *image.Processor,
	photoRepo repository.PhotoRepository,
	galleryRepo repository.GalleryRepository,
	thumbnailBucket, optimizedBucket string,
) *ProcessingPipeline {
	// Build the chain
	download := NewDownloadHandler(s3Downloader)
	dimensions := NewDimensionsHandler(processor)
	metadata := NewMetadataHandler(processor)
	thumbnail := NewThumbnailHandler(processor)
	optimized := NewOptimizedHandler(processor)
	upload := NewUploadHandler(s3Uploader, thumbnailBucket, optimizedBucket)
	dbUpdate := NewDatabaseUpdateHandler(photoRepo, galleryRepo)

	// Chain them together
	download.SetNext(dimensions).
		SetNext(metadata).
		SetNext(thumbnail).
		SetNext(optimized).
		SetNext(upload).
		SetNext(dbUpdate)

	return &ProcessingPipeline{firstHandler: download}
}

// Process runs the photo through the processing pipeline.
func (p *ProcessingPipeline) Process(ctx context.Context, photoID, galleryID, objectKey, bucketName string, gallery *repository.Gallery) error {
	pctx := NewProcessingContext(ctx, photoID, galleryID, objectKey, bucketName)
	pctx.Gallery = gallery
	return p.firstHandler.Handle(pctx)
}
