package photo

import (
	"context"
	"time"

	"photographer-gallery/backend/internal/repository"
	"photographer-gallery/backend/internal/services/storage"
	"photographer-gallery/backend/pkg/errors"
	"photographer-gallery/backend/pkg/logger"
	"photographer-gallery/backend/pkg/utils"
)

// Service handles photo business logic
type Service struct {
	photoRepo    repository.PhotoRepository
	galleryRepo  repository.GalleryRepository
	favoriteRepo repository.FavoriteRepository
	storageService *storage.Service
}

// NewService creates a new photo service
func NewService(
	photoRepo repository.PhotoRepository,
	galleryRepo repository.GalleryRepository,
	favoriteRepo repository.FavoriteRepository,
	storageService *storage.Service,
) *Service {
	return &Service{
		photoRepo:      photoRepo,
		galleryRepo:    galleryRepo,
		favoriteRepo:   favoriteRepo,
		storageService: storageService,
	}
}

// UploadURLRequest represents a request for an upload URL
type UploadURLRequest struct {
	GalleryID string
	FileName  string
	MimeType  string
}

// UploadURLResponse contains the upload URL and photo metadata
type UploadURLResponse struct {
	PhotoID   string
	UploadURL string
	Key       string
}

// GenerateUploadURL creates a presigned URL for uploading a photo
func (s *Service) GenerateUploadURL(ctx context.Context, req UploadURLRequest) (*UploadURLResponse, error) {
	// Verify gallery exists
	gallery, err := s.galleryRepo.GetByID(ctx, req.GalleryID)
	if err != nil {
		return nil, errors.Wrap(err, 500, "Failed to get gallery")
	}
	if gallery == nil {
		return nil, errors.NewNotFound("Gallery")
	}

	// Validate file type
	if !isValidImageType(req.MimeType) {
		return nil, errors.NewBadRequest("Invalid image type. Supported: JPEG, PNG, WebP")
	}

	// Generate photo ID
	photoID := utils.GenerateID("photo")

	// Generate presigned upload URL
	uploadResp, err := s.storageService.GenerateUploadURL(ctx, storage.UploadURLRequest{
		GalleryID: req.GalleryID,
		PhotoID:   photoID,
		FileName:  req.FileName,
		MimeType:  req.MimeType,
	})

	if err != nil {
		return nil, errors.Wrap(err, 500, "Failed to generate upload URL")
	}

	logger.Info("Generated upload URL for photo", map[string]interface{}{
		"photoId":   photoID,
		"galleryId": req.GalleryID,
		"fileName":  req.FileName,
	})

	return &UploadURLResponse{
		PhotoID:   photoID,
		UploadURL: uploadResp.URL,
		Key:       uploadResp.Key,
	}, nil
}

// CreatePhotoRequest represents photo metadata after upload
type CreatePhotoRequest struct {
	PhotoID      string
	GalleryID    string
	FileName     string
	OriginalKey  string
	OptimizedKey string
	ThumbnailKey string
	MimeType     string
	Size         int64
	Width        int
	Height       int
	Metadata     map[string]string
}

// Create creates a photo record after successful upload
func (s *Service) Create(ctx context.Context, req CreatePhotoRequest) (*repository.Photo, error) {
	// Verify gallery exists
	gallery, err := s.galleryRepo.GetByID(ctx, req.GalleryID)
	if err != nil {
		return nil, errors.Wrap(err, 500, "Failed to get gallery")
	}
	if gallery == nil {
		return nil, errors.NewNotFound("Gallery")
	}

	photo := &repository.Photo{
		PhotoID:       req.PhotoID,
		GalleryID:     req.GalleryID,
		FileName:      req.FileName,
		OriginalKey:   req.OriginalKey,
		OptimizedKey:  req.OptimizedKey,
		ThumbnailKey:  req.ThumbnailKey,
		MimeType:      req.MimeType,
		Size:          req.Size,
		Width:         req.Width,
		Height:        req.Height,
		UploadedAt:    time.Now(),
		FavoriteCount: 0,
		DownloadCount: 0,
		Metadata:      req.Metadata,
	}

	// Create photo record
	if err := s.photoRepo.Create(ctx, photo); err != nil {
		logger.Error("Failed to create photo", map[string]interface{}{"error": err.Error()})
		return nil, errors.Wrap(err, 500, "Failed to create photo")
	}

	// Update gallery photo count and total size
	if err := s.galleryRepo.UpdatePhotoCount(ctx, req.GalleryID, 1); err != nil {
		logger.Error("Failed to update photo count", map[string]interface{}{"error": err.Error()})
	}
	if err := s.galleryRepo.UpdateTotalSize(ctx, req.GalleryID, req.Size); err != nil {
		logger.Error("Failed to update total size", map[string]interface{}{"error": err.Error()})
	}

	logger.Info("Photo created", map[string]interface{}{
		"photoId":   photo.PhotoID,
		"galleryId": photo.GalleryID,
		"size":      photo.Size,
	})

	return photo, nil
}

// GetByID retrieves a photo by ID
func (s *Service) GetByID(ctx context.Context, photoID string) (*repository.Photo, error) {
	photo, err := s.photoRepo.GetByID(ctx, photoID)
	if err != nil {
		return nil, errors.Wrap(err, 500, "Failed to get photo")
	}
	if photo == nil {
		return nil, errors.NewNotFound("Photo")
	}
	return photo, nil
}

// ListByGallery lists photos in a gallery with pagination
func (s *Service) ListByGallery(ctx context.Context, galleryID string, limit int, lastKey map[string]interface{}) ([]*repository.Photo, map[string]interface{}, error) {
	photos, nextKey, err := s.photoRepo.ListByGallery(ctx, galleryID, limit, lastKey)
	if err != nil {
		return nil, nil, errors.Wrap(err, 500, "Failed to list photos")
	}
	return photos, nextKey, nil
}

// Delete deletes a photo and all its files
func (s *Service) Delete(ctx context.Context, photoID string) error {
	// Get photo
	photo, err := s.GetByID(ctx, photoID)
	if err != nil {
		return err
	}

	// Delete from S3
	if err := s.storageService.DeletePhoto(ctx, photo.OriginalKey, photo.OptimizedKey, photo.ThumbnailKey); err != nil {
		logger.Error("Failed to delete photo files", map[string]interface{}{"error": err.Error()})
		// Continue with deletion even if S3 fails
	}

	// Delete from DynamoDB
	if err := s.photoRepo.Delete(ctx, photoID); err != nil {
		logger.Error("Failed to delete photo record", map[string]interface{}{"error": err.Error()})
		return errors.Wrap(err, 500, "Failed to delete photo")
	}

	// Update gallery stats
	if err := s.galleryRepo.UpdatePhotoCount(ctx, photo.GalleryID, -1); err != nil {
		logger.Error("Failed to update photo count", map[string]interface{}{"error": err.Error()})
	}
	if err := s.galleryRepo.UpdateTotalSize(ctx, photo.GalleryID, -photo.Size); err != nil {
		logger.Error("Failed to update total size", map[string]interface{}{"error": err.Error()})
	}

	logger.Info("Photo deleted", map[string]interface{}{
		"photoId":   photo.PhotoID,
		"galleryId": photo.GalleryID,
	})

	return nil
}

// GetDownloadURL generates a presigned download URL for a photo
func (s *Service) GetDownloadURL(ctx context.Context, photoID string) (string, error) {
	photo, err := s.GetByID(ctx, photoID)
	if err != nil {
		return "", err
	}

	// Increment download count
	if err := s.photoRepo.IncrementDownloadCount(ctx, photoID); err != nil {
		logger.Error("Failed to increment download count", map[string]interface{}{"error": err.Error()})
		// Continue anyway
	}

	// Generate download URL for optimized version
	url, err := s.storageService.GenerateDownloadURL(ctx, photo.OptimizedKey, "", photo.FileName)
	if err != nil {
		return "", errors.Wrap(err, 500, "Failed to generate download URL")
	}

	logger.Info("Generated download URL", map[string]interface{}{
		"photoId": photo.PhotoID,
	})

	return url, nil
}

// ToggleFavorite toggles a photo's favorite status for a client session
func (s *Service) ToggleFavorite(ctx context.Context, galleryID, sessionID, photoID string) (bool, error) {
	// Check if already favorited
	isFavorited, err := s.favoriteRepo.IsFavorited(ctx, galleryID, sessionID, photoID)
	if err != nil {
		return false, errors.Wrap(err, 500, "Failed to check favorite status")
	}

	if isFavorited {
		// Remove favorite
		if err := s.favoriteRepo.Delete(ctx, galleryID, sessionID, photoID); err != nil {
			return false, errors.Wrap(err, 500, "Failed to remove favorite")
		}
		// Decrement count
		if err := s.photoRepo.IncrementFavoriteCount(ctx, photoID, -1); err != nil {
			logger.Error("Failed to decrement favorite count", map[string]interface{}{"error": err.Error()})
		}
		logger.Info("Photo unfavorited", map[string]interface{}{"photoId": photoID})
		return false, nil
	} else {
		// Add favorite
		favorite := &repository.Favorite{
			GalleryID:   galleryID,
			SessionID:   sessionID,
			PhotoID:     photoID,
			FavoritedAt: time.Now(),
		}
		if err := s.favoriteRepo.Create(ctx, favorite); err != nil {
			return false, errors.Wrap(err, 500, "Failed to add favorite")
		}
		// Increment count
		if err := s.photoRepo.IncrementFavoriteCount(ctx, photoID, 1); err != nil {
			logger.Error("Failed to increment favorite count", map[string]interface{}{"error": err.Error()})
		}
		logger.Info("Photo favorited", map[string]interface{}{"photoId": photoID})
		return true, nil
	}
}

// ListFavoritesBySession lists favorites for a client session
func (s *Service) ListFavoritesBySession(ctx context.Context, galleryID, sessionID string) ([]*repository.Favorite, error) {
	favorites, err := s.favoriteRepo.ListBySession(ctx, galleryID, sessionID)
	if err != nil {
		return nil, errors.Wrap(err, 500, "Failed to list favorites")
	}
	return favorites, nil
}

// ListFavoritesByGallery lists all favorites for a gallery (photographer view)
func (s *Service) ListFavoritesByGallery(ctx context.Context, galleryID string) ([]*repository.Favorite, error) {
	favorites, err := s.favoriteRepo.ListByGallery(ctx, galleryID)
	if err != nil {
		return nil, errors.Wrap(err, 500, "Failed to list gallery favorites")
	}
	return favorites, nil
}

// Helper function to validate image types
func isValidImageType(mimeType string) bool {
	validTypes := map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
		"image/webp": true,
	}
	return validTypes[mimeType]
}
