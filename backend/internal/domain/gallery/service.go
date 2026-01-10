package gallery

import (
	"context"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
	"photographer-gallery/backend/internal/repository"
	"photographer-gallery/backend/pkg/errors"
	"photographer-gallery/backend/pkg/logger"
	"photographer-gallery/backend/pkg/utils"
)

const photoDeletionBatchSize = 100

// StorageService defines the interface for storage operations.
type StorageService interface {
	DeletePhoto(ctx context.Context, originalKey, optimizedKey, thumbnailKey string) error
}

// Service handles gallery business logic.
type Service struct {
	galleryRepo    repository.GalleryRepository
	photoRepo      repository.PhotoRepository
	storageService StorageService
}

// NewService creates a new gallery service.
func NewService(galleryRepo repository.GalleryRepository, photoRepo repository.PhotoRepository, storageService StorageService) *Service {
	return &Service{galleryRepo: galleryRepo, photoRepo: photoRepo, storageService: storageService}
}

// CreateGalleryRequest represents the request to create a gallery.
type CreateGalleryRequest struct {
	PhotographerID, Name, Description, CustomURL, Password string
	ExpiresAt                                              *time.Time
	EnableWatermark                                        bool
	WatermarkText, WatermarkPosition                       string
}

// UpdateGalleryRequest represents the request to update a gallery.
type UpdateGalleryRequest struct {
	Name, Description, Password, WatermarkText, WatermarkPosition *string
	ExpiresAt                                                     *time.Time
	EnableWatermark                                               *bool
}

// Create creates a new gallery.
func (s *Service) Create(ctx context.Context, req CreateGalleryRequest) (*repository.Gallery, error) {
	if req.CustomURL == "" {
		req.CustomURL = utils.GenerateCustomURL(req.Name)
	} else if !utils.ValidateCustomURL(req.CustomURL) {
		return nil, errors.NewBadRequest("Invalid custom URL format")
	}

	if existing, _ := s.galleryRepo.GetByCustomURL(ctx, req.CustomURL); existing != nil {
		return nil, errors.New(409, "Custom URL already exists")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.NewInternalServer("Failed to hash password")
	}

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
		EnableWatermark:   req.EnableWatermark,
		WatermarkText:     req.WatermarkText,
		WatermarkPosition: req.WatermarkPosition,
	}

	if err := s.galleryRepo.Create(ctx, gallery); err != nil {
		return nil, errors.Wrap(err, 500, "Failed to create gallery")
	}
	logger.Info("Gallery created", map[string]interface{}{"galleryId": gallery.GalleryID})
	return gallery, nil
}

// GetByID retrieves a gallery by ID.
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

// GetByCustomURL retrieves a gallery by custom URL.
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

// ListByPhotographer lists galleries for a photographer.
func (s *Service) ListByPhotographer(ctx context.Context, photographerID string, limit int, lastKey map[string]interface{}) ([]*repository.Gallery, map[string]interface{}, error) {
	galleries, nextKey, err := s.galleryRepo.ListByPhotographer(ctx, photographerID, limit, lastKey)
	if err != nil {
		return nil, nil, errors.Wrap(err, 500, "Failed to list galleries")
	}
	return galleries, nextKey, nil
}

// Update updates a gallery.
func (s *Service) Update(ctx context.Context, galleryID string, req UpdateGalleryRequest) (*repository.Gallery, error) {
	gallery, err := s.GetByID(ctx, galleryID)
	if err != nil {
		return nil, err
	}

	s.applyUpdates(gallery, req)

	if err := s.galleryRepo.Update(ctx, gallery); err != nil {
		return nil, errors.Wrap(err, 500, "Failed to update gallery")
	}
	logger.Info("Gallery updated", map[string]interface{}{"galleryId": gallery.GalleryID})
	return gallery, nil
}

func (s *Service) applyUpdates(gallery *repository.Gallery, req UpdateGalleryRequest) {
	if req.Name != nil {
		gallery.Name = *req.Name
	}
	if req.Description != nil {
		gallery.Description = *req.Description
	}
	if req.Password != nil {
		if hash, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost); err == nil {
			gallery.Password = string(hash)
		}
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
}

// Delete deletes a gallery and all its photos.
func (s *Service) Delete(ctx context.Context, galleryID string) error {
	gallery, err := s.GetByID(ctx, galleryID)
	if err != nil {
		return err
	}

	photos, err := s.fetchAllPhotos(ctx, galleryID)
	if err != nil {
		return errors.Wrap(err, 500, "Failed to list photos for deletion")
	}

	failedS3, failedDB := s.deletePhotos(ctx, photos)
	if failedS3 > 0 || failedDB > 0 {
		logger.Warn("Gallery deletion completed with failures", map[string]interface{}{
			"galleryId": gallery.GalleryID, "failedS3": failedS3, "failedDB": failedDB,
		})
	}

	if err := s.galleryRepo.Delete(ctx, galleryID); err != nil {
		return errors.Wrap(err, 500, "Failed to delete gallery")
	}
	logger.Info("Gallery deleted", map[string]interface{}{"galleryId": gallery.GalleryID, "photos": len(photos)})
	return nil
}

func (s *Service) fetchAllPhotos(ctx context.Context, galleryID string) ([]*repository.Photo, error) {
	var all []*repository.Photo
	var lastKey map[string]interface{}
	for {
		photos, nextKey, err := s.photoRepo.ListByGallery(ctx, galleryID, photoDeletionBatchSize, lastKey)
		if err != nil {
			return nil, err
		}
		all = append(all, photos...)
		if nextKey == nil {
			break
		}
		lastKey = nextKey
	}
	return all, nil
}

func (s *Service) deletePhotos(ctx context.Context, photos []*repository.Photo) (failedS3, failedDB int) {
	for _, photo := range photos {
		if s.storageService != nil {
			if err := s.storageService.DeletePhoto(ctx, photo.OriginalKey, photo.OptimizedKey, photo.ThumbnailKey); err != nil {
				failedS3++
			}
		}
		if err := s.photoRepo.Delete(ctx, photo.PhotoID); err != nil {
			failedDB++
		}
	}
	return
}

// VerifyPassword verifies a gallery password.
func (s *Service) VerifyPassword(ctx context.Context, customURL, password string) (*repository.Gallery, error) {
	gallery, err := s.GetByCustomURL(ctx, customURL)
	if err != nil {
		return nil, err
	}

	if gallery.Status != "active" {
		return nil, errors.NewBadRequest("Gallery is not active")
	}
	if gallery.ExpiresAt != nil && gallery.ExpiresAt.Before(time.Now()) {
		return nil, errors.NewBadRequest("Gallery has expired")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(gallery.Password), []byte(password)); err != nil {
		return nil, errors.NewUnauthorized("Invalid password")
	}

	s.galleryRepo.IncrementClientAccessCount(ctx, gallery.GalleryID)
	return gallery, nil
}

// SetExpiration sets the expiration date for a gallery.
func (s *Service) SetExpiration(ctx context.Context, galleryID string, expiresAt *time.Time) (*repository.Gallery, error) {
	gallery, err := s.GetByID(ctx, galleryID)
	if err != nil {
		return nil, err
	}
	gallery.ExpiresAt = expiresAt
	if err := s.galleryRepo.Update(ctx, gallery); err != nil {
		return nil, errors.Wrap(err, 500, "Failed to update gallery expiration")
	}
	logger.Info("Gallery expiration updated", map[string]interface{}{"galleryId": gallery.GalleryID})
	return gallery, nil
}

// ProcessExpiredGalleries processes galleries that have expired.
func (s *Service) ProcessExpiredGalleries(ctx context.Context, limit int) error {
	galleries, err := s.galleryRepo.ListExpired(ctx, limit)
	if err != nil {
		return errors.Wrap(err, 500, "Failed to list expired galleries")
	}

	var errorCount int
	for _, gallery := range galleries {
		if err := s.Delete(ctx, gallery.GalleryID); err != nil {
			logger.Error("Failed to delete expired gallery", map[string]interface{}{
				"galleryId": gallery.GalleryID, "error": err.Error(),
			})
			errorCount++
			continue
		}
		logger.Info("Deleted expired gallery", map[string]interface{}{"galleryId": gallery.GalleryID})
	}

	if errorCount > 0 {
		return fmt.Errorf("completed with %d errors out of %d galleries", errorCount, len(galleries))
	}
	return nil
}
