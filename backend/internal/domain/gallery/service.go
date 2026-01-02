package gallery

import (
	"context"
	"time"

	"golang.org/x/crypto/bcrypt"
	"photographer-gallery/backend/internal/repository"
	"photographer-gallery/backend/pkg/errors"
	"photographer-gallery/backend/pkg/logger"
	"photographer-gallery/backend/pkg/utils"
)

const (
	// photoDeletionBatchSize is the number of photos to fetch per batch when deleting a gallery
	photoDeletionBatchSize = 100
)

// StorageService defines the interface for storage operations
type StorageService interface {
	DeletePhoto(ctx context.Context, originalKey, optimizedKey, thumbnailKey string) error
}

// Service handles gallery business logic
type Service struct {
	galleryRepo    repository.GalleryRepository
	photoRepo      repository.PhotoRepository
	storageService StorageService
}

// NewService creates a new gallery service
func NewService(galleryRepo repository.GalleryRepository, photoRepo repository.PhotoRepository, storageService StorageService) *Service {
	return &Service{
		galleryRepo:    galleryRepo,
		photoRepo:      photoRepo,
		storageService: storageService,
	}
}

// CreateGalleryRequest represents the request to create a gallery
type CreateGalleryRequest struct {
	PhotographerID    string
	Name              string
	Description       string
	CustomURL         string
	Password          string
	ExpiresAt         *time.Time
	EnableWatermark   bool
	WatermarkText     string
	WatermarkPosition string
}

// UpdateGalleryRequest represents the request to update a gallery
type UpdateGalleryRequest struct {
	Name              *string
	Description       *string
	Password          *string
	ExpiresAt         *time.Time
	EnableWatermark   *bool
	WatermarkText     *string
	WatermarkPosition *string
}

// Create creates a new gallery
func (s *Service) Create(ctx context.Context, req CreateGalleryRequest) (*repository.Gallery, error) {
	// Validate custom URL
	if req.CustomURL == "" {
		req.CustomURL = utils.GenerateCustomURL(req.Name)
	} else if !utils.ValidateCustomURL(req.CustomURL) {
		return nil, errors.NewBadRequest("Invalid custom URL format")
	}

	// Check if custom URL already exists
	existing, err := s.galleryRepo.GetByCustomURL(ctx, req.CustomURL)
	if err == nil && existing != nil {
		return nil, errors.New(409, "Custom URL already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		logger.Error("Failed to hash password", map[string]interface{}{"error": err.Error()})
		return nil, errors.NewInternalServer("Failed to hash password")
	}

	// Create gallery
	gallery := &repository.Gallery{
		GalleryID:         utils.GenerateID("gal"),
		PhotographerID:    req.PhotographerID,
		Name:              req.Name,
		Description:       req.Description,
		CustomURL:         req.CustomURL,
		Password:          string(hashedPassword),
		CreatedAt:         time.Now(),
		ExpiresAt:         req.ExpiresAt,
		Status:            "active",
		PhotoCount:        0,
		TotalSize:         0,
		ClientAccessCount: 0,
		EnableWatermark:   req.EnableWatermark,
		WatermarkText:     req.WatermarkText,
		WatermarkPosition: req.WatermarkPosition,
	}

	if err := s.galleryRepo.Create(ctx, gallery); err != nil {
		logger.Error("Failed to create gallery", map[string]interface{}{"error": err.Error()})
		return nil, errors.Wrap(err, 500, "Failed to create gallery")
	}

	logger.Info("Gallery created", map[string]interface{}{
		"galleryId": gallery.GalleryID,
		"customUrl": gallery.CustomURL,
	})

	return gallery, nil
}

// GetByID retrieves a gallery by ID
func (s *Service) GetByID(ctx context.Context, galleryID string) (*repository.Gallery, error) {
	gallery, err := s.galleryRepo.GetByID(ctx, galleryID)
	if err != nil {
		return nil, errors.Wrap(err, 500, "Failed to get gallery")
	}
	if gallery == nil {
		return nil, errors.NewNotFound("Gallery")
	}
	return gallery, nil
}

// GetByCustomURL retrieves a gallery by custom URL
func (s *Service) GetByCustomURL(ctx context.Context, customURL string) (*repository.Gallery, error) {
	gallery, err := s.galleryRepo.GetByCustomURL(ctx, customURL)
	if err != nil {
		return nil, errors.Wrap(err, 500, "Failed to get gallery")
	}
	if gallery == nil {
		return nil, errors.NewNotFound("Gallery")
	}
	return gallery, nil
}

// ListByPhotographer lists galleries for a photographer
func (s *Service) ListByPhotographer(ctx context.Context, photographerID string, limit int, lastKey map[string]interface{}) ([]*repository.Gallery, map[string]interface{}, error) {
	galleries, nextKey, err := s.galleryRepo.ListByPhotographer(ctx, photographerID, limit, lastKey)
	if err != nil {
		return nil, nil, errors.Wrap(err, 500, "Failed to list galleries")
	}
	return galleries, nextKey, nil
}

// Update updates a gallery
func (s *Service) Update(ctx context.Context, galleryID string, req UpdateGalleryRequest) (*repository.Gallery, error) {
	gallery, err := s.GetByID(ctx, galleryID)
	if err != nil {
		return nil, err
	}

	// Update fields
	if req.Name != nil {
		gallery.Name = *req.Name
	}
	if req.Description != nil {
		gallery.Description = *req.Description
	}
	if req.Password != nil {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err != nil {
			logger.Error("Failed to hash password", map[string]interface{}{"error": err.Error()})
			return nil, errors.NewInternalServer("Failed to hash password")
		}
		gallery.Password = string(hashedPassword)
	}
	if req.ExpiresAt != nil {
		gallery.ExpiresAt = req.ExpiresAt
	}
	if req.EnableWatermark != nil {
		gallery.EnableWatermark = *req.EnableWatermark
	}
	if req.WatermarkText != nil {
		gallery.WatermarkText = *req.WatermarkText
	}
	if req.WatermarkPosition != nil {
		gallery.WatermarkPosition = *req.WatermarkPosition
	}

	if err := s.galleryRepo.Update(ctx, gallery); err != nil {
		logger.Error("Failed to update gallery", map[string]interface{}{"error": err.Error()})
		return nil, errors.Wrap(err, 500, "Failed to update gallery")
	}

	logger.Info("Gallery updated", map[string]interface{}{"galleryId": gallery.GalleryID})
	return gallery, nil
}

// Delete deletes a gallery and all its photos
func (s *Service) Delete(ctx context.Context, galleryID string) error {
	// Check if gallery exists
	gallery, err := s.GetByID(ctx, galleryID)
	if err != nil {
		return err
	}

	// Delete all photos from S3 and DynamoDB
	// Fetch all photos in batches to handle large galleries efficiently
	var allPhotos []*repository.Photo
	var lastKey map[string]interface{}

	for {
		photos, nextKey, err := s.photoRepo.ListByGallery(ctx, galleryID, photoDeletionBatchSize, lastKey)
		if err != nil {
			logger.Error("Failed to list photos for deletion", map[string]interface{}{
				"error":     err.Error(),
				"galleryId": galleryID,
			})
			return errors.Wrap(err, 500, "Failed to list photos for deletion")
		}

		allPhotos = append(allPhotos, photos...)

		if nextKey == nil {
			break
		}
		lastKey = nextKey
	}

	// Track deletion failures for logging
	var failedS3Deletions int
	var failedDBDeletions int

	// Delete each photo from S3 and DynamoDB
	for _, photo := range allPhotos {
		// Delete from S3 first (files)
		if s.storageService != nil {
			if err := s.storageService.DeletePhoto(ctx, photo.OriginalKey, photo.OptimizedKey, photo.ThumbnailKey); err != nil {
				failedS3Deletions++
				logger.Error("Failed to delete photo from S3", map[string]interface{}{
					"error":   err.Error(),
					"photoId": photo.PhotoID,
				})
				// Continue with other photos even if one fails
			}
		}

		// Delete from DynamoDB (metadata)
		if err := s.photoRepo.Delete(ctx, photo.PhotoID); err != nil {
			failedDBDeletions++
			logger.Error("Failed to delete photo from database", map[string]interface{}{
				"error":   err.Error(),
				"photoId": photo.PhotoID,
			})
			// Continue with other photos even if one fails
		}
	}

	// Log deletion summary
	if failedS3Deletions > 0 || failedDBDeletions > 0 {
		logger.Warn("Gallery deletion completed with some failures", map[string]interface{}{
			"galleryId":          gallery.GalleryID,
			"totalPhotos":        len(allPhotos),
			"failedS3Deletions":  failedS3Deletions,
			"failedDBDeletions":  failedDBDeletions,
		})
	}

	logger.Info("Deleted all photos for gallery", map[string]interface{}{
		"galleryId":  gallery.GalleryID,
		"photoCount": len(allPhotos),
	})

	// Delete the gallery from DynamoDB
	if err := s.galleryRepo.Delete(ctx, galleryID); err != nil {
		logger.Error("Failed to delete gallery", map[string]interface{}{"error": err.Error()})
		return errors.Wrap(err, 500, "Failed to delete gallery")
	}

	logger.Info("Gallery deleted", map[string]interface{}{
		"galleryId": gallery.GalleryID,
	})

	return nil
}

// VerifyPassword verifies a gallery password
func (s *Service) VerifyPassword(ctx context.Context, customURL, password string) (*repository.Gallery, error) {
	gallery, err := s.GetByCustomURL(ctx, customURL)
	if err != nil {
		return nil, err
	}

	// Check if gallery is active
	if gallery.Status != "active" {
		return nil, errors.NewBadRequest("Gallery is not active")
	}

	// Check if gallery is expired
	if gallery.ExpiresAt != nil && gallery.ExpiresAt.Before(time.Now()) {
		return nil, errors.NewBadRequest("Gallery has expired")
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(gallery.Password), []byte(password)); err != nil {
		logger.Warn("Invalid gallery password attempt", map[string]interface{}{
			"customUrl": customURL,
		})
		return nil, errors.NewUnauthorized("Invalid password")
	}

	// Increment access count
	if err := s.galleryRepo.IncrementClientAccessCount(ctx, gallery.GalleryID); err != nil {
		logger.Error("Failed to increment access count", map[string]interface{}{"error": err.Error()})
		// Don't fail the request for this
	}

	return gallery, nil
}

// SetExpiration sets the expiration date for a gallery
func (s *Service) SetExpiration(ctx context.Context, galleryID string, expiresAt *time.Time) (*repository.Gallery, error) {
	gallery, err := s.GetByID(ctx, galleryID)
	if err != nil {
		return nil, err
	}

	gallery.ExpiresAt = expiresAt

	if err := s.galleryRepo.Update(ctx, gallery); err != nil {
		logger.Error("Failed to update gallery expiration", map[string]interface{}{"error": err.Error()})
		return nil, errors.Wrap(err, 500, "Failed to update gallery expiration")
	}

	logger.Info("Gallery expiration updated", map[string]interface{}{
		"galleryId": gallery.GalleryID,
		"expiresAt": expiresAt,
	})

	return gallery, nil
}

// ProcessExpiredGalleries processes galleries that have expired
func (s *Service) ProcessExpiredGalleries(ctx context.Context, limit int) error {
	galleries, err := s.galleryRepo.ListExpired(ctx, limit)
	if err != nil {
		return errors.Wrap(err, 500, "Failed to list expired galleries")
	}

	for _, gallery := range galleries {
		gallery.Status = "expired"
		if err := s.galleryRepo.Update(ctx, gallery); err != nil {
			logger.Error("Failed to update expired gallery", map[string]interface{}{
				"galleryId": gallery.GalleryID,
				"error":     err.Error(),
			})
			continue
		}
		logger.Info("Gallery marked as expired", map[string]interface{}{
			"galleryId": gallery.GalleryID,
		})
	}

	return nil
}
