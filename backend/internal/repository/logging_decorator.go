// Package repository provides data access abstractions with decorator support.
package repository

import (
	"context"
	"time"

	"photographer-gallery/backend/pkg/logger"
)

// LoggingGalleryRepository wraps a GalleryRepository with logging.
type LoggingGalleryRepository struct {
	repo GalleryRepository
}

// NewLoggingGalleryRepository creates a new logging decorator.
func NewLoggingGalleryRepository(repo GalleryRepository) GalleryRepository {
	return &LoggingGalleryRepository{repo: repo}
}

// Create logs gallery creation operations.
func (r *LoggingGalleryRepository) Create(ctx context.Context, gallery *Gallery) error {
	start := time.Now()
	err := r.repo.Create(ctx, gallery)
	r.logOperation("Create", gallery.GalleryID, start, err)
	return err
}

// GetByID logs gallery retrieval operations.
func (r *LoggingGalleryRepository) GetByID(ctx context.Context, galleryID string) (*Gallery, error) {
	start := time.Now()
	gallery, err := r.repo.GetByID(ctx, galleryID)
	r.logOperation("GetByID", galleryID, start, err)
	return gallery, err
}

// GetByCustomURL logs custom URL lookup operations.
func (r *LoggingGalleryRepository) GetByCustomURL(ctx context.Context, customURL string) (*Gallery, error) {
	start := time.Now()
	gallery, err := r.repo.GetByCustomURL(ctx, customURL)
	r.logOperation("GetByCustomURL", customURL, start, err)
	return gallery, err
}

// Update logs gallery update operations.
func (r *LoggingGalleryRepository) Update(ctx context.Context, gallery *Gallery) error {
	start := time.Now()
	err := r.repo.Update(ctx, gallery)
	r.logOperation("Update", gallery.GalleryID, start, err)
	return err
}

// Delete logs gallery deletion operations.
func (r *LoggingGalleryRepository) Delete(ctx context.Context, galleryID string) error {
	start := time.Now()
	err := r.repo.Delete(ctx, galleryID)
	r.logOperation("Delete", galleryID, start, err)
	return err
}

// ListByPhotographer logs photographer gallery listing operations.
func (r *LoggingGalleryRepository) ListByPhotographer(ctx context.Context, photographerID string, limit int, lastKey map[string]interface{}) ([]*Gallery, map[string]interface{}, error) {
	start := time.Now()
	galleries, nextKey, err := r.repo.ListByPhotographer(ctx, photographerID, limit, lastKey)
	r.logOperation("ListByPhotographer", photographerID, start, err)
	return galleries, nextKey, err
}

// UpdatePhotoCount logs photo count update operations.
func (r *LoggingGalleryRepository) UpdatePhotoCount(ctx context.Context, galleryID string, delta int) error {
	start := time.Now()
	err := r.repo.UpdatePhotoCount(ctx, galleryID, delta)
	r.logOperation("UpdatePhotoCount", galleryID, start, err)
	return err
}

// ListExpired logs expired gallery listing operations.
func (r *LoggingGalleryRepository) ListExpired(ctx context.Context, limit int) ([]*Gallery, error) {
	start := time.Now()
	galleries, err := r.repo.ListExpired(ctx, limit)
	r.logOperation("ListExpired", "all", start, err)
	return galleries, err
}

// UpdateTotalSize logs total size update operations.
func (r *LoggingGalleryRepository) UpdateTotalSize(ctx context.Context, galleryID string, deltaBytes int64) error {
	start := time.Now()
	err := r.repo.UpdateTotalSize(ctx, galleryID, deltaBytes)
	r.logOperation("UpdateTotalSize", galleryID, start, err)
	return err
}

// IncrementClientAccessCount logs client access count increment operations.
func (r *LoggingGalleryRepository) IncrementClientAccessCount(ctx context.Context, galleryID string) error {
	start := time.Now()
	err := r.repo.IncrementClientAccessCount(ctx, galleryID)
	r.logOperation("IncrementClientAccessCount", galleryID, start, err)
	return err
}

// IncrementViewCount logs view count increment operations.
func (r *LoggingGalleryRepository) IncrementViewCount(ctx context.Context, galleryID string, delta int64) error {
	start := time.Now()
	err := r.repo.IncrementViewCount(ctx, galleryID, delta)
	r.logOperation("IncrementViewCount", galleryID, start, err)
	return err
}

// IncrementDownloadCount logs download count increment operations.
func (r *LoggingGalleryRepository) IncrementDownloadCount(ctx context.Context, galleryID string, delta int64) error {
	start := time.Now()
	err := r.repo.IncrementDownloadCount(ctx, galleryID, delta)
	r.logOperation("IncrementDownloadCount", galleryID, start, err)
	return err
}

// IncrementFavoriteCount logs favorite count increment operations.
func (r *LoggingGalleryRepository) IncrementFavoriteCount(ctx context.Context, galleryID string, delta int) error {
	start := time.Now()
	err := r.repo.IncrementFavoriteCount(ctx, galleryID, delta)
	r.logOperation("IncrementFavoriteCount", galleryID, start, err)
	return err
}

// IncrementUniqueClients logs unique clients increment operations.
func (r *LoggingGalleryRepository) IncrementUniqueClients(ctx context.Context, galleryID string) error {
	start := time.Now()
	err := r.repo.IncrementUniqueClients(ctx, galleryID)
	r.logOperation("IncrementUniqueClients", galleryID, start, err)
	return err
}

// UpdateLastClientAccess logs last client access update operations.
func (r *LoggingGalleryRepository) UpdateLastClientAccess(ctx context.Context, galleryID string) error {
	start := time.Now()
	err := r.repo.UpdateLastClientAccess(ctx, galleryID)
	r.logOperation("UpdateLastClientAccess", galleryID, start, err)
	return err
}

func (r *LoggingGalleryRepository) logOperation(operation, identifier string, start time.Time, err error) {
	duration := time.Since(start)
	fields := map[string]interface{}{
		"repository": "gallery",
		"operation":  operation,
		"identifier": identifier,
		"duration":   duration.String(),
		"durationMs": duration.Milliseconds(),
	}

	if err != nil {
		fields["error"] = err.Error()
		logger.Error("Repository operation failed", fields)
	} else {
		logger.Debug("Repository operation completed", fields)
	}
}

// LoggingPhotoRepository wraps a PhotoRepository with logging.
type LoggingPhotoRepository struct {
	repo PhotoRepository
}

// NewLoggingPhotoRepository creates a new logging decorator.
func NewLoggingPhotoRepository(repo PhotoRepository) PhotoRepository {
	return &LoggingPhotoRepository{repo: repo}
}

// Create logs photo creation operations.
func (r *LoggingPhotoRepository) Create(ctx context.Context, photo *Photo) error {
	start := time.Now()
	err := r.repo.Create(ctx, photo)
	r.logOperation("Create", photo.PhotoID, start, err)
	return err
}

// GetByID logs photo retrieval operations.
func (r *LoggingPhotoRepository) GetByID(ctx context.Context, photoID string) (*Photo, error) {
	start := time.Now()
	photo, err := r.repo.GetByID(ctx, photoID)
	r.logOperation("GetByID", photoID, start, err)
	return photo, err
}

// Update logs photo update operations.
func (r *LoggingPhotoRepository) Update(ctx context.Context, photo *Photo) error {
	start := time.Now()
	err := r.repo.Update(ctx, photo)
	r.logOperation("Update", photo.PhotoID, start, err)
	return err
}

// Delete logs photo deletion operations.
func (r *LoggingPhotoRepository) Delete(ctx context.Context, photoID string) error {
	start := time.Now()
	err := r.repo.Delete(ctx, photoID)
	r.logOperation("Delete", photoID, start, err)
	return err
}

// ListByGallery logs gallery photo listing operations.
func (r *LoggingPhotoRepository) ListByGallery(ctx context.Context, galleryID string, limit int, lastKey map[string]interface{}) ([]*Photo, map[string]interface{}, error) {
	start := time.Now()
	photos, nextKey, err := r.repo.ListByGallery(ctx, galleryID, limit, lastKey)
	r.logOperation("ListByGallery", galleryID, start, err)
	return photos, nextKey, err
}

// IncrementFavoriteCount logs favorite count increment operations.
func (r *LoggingPhotoRepository) IncrementFavoriteCount(ctx context.Context, photoID string, delta int) error {
	start := time.Now()
	err := r.repo.IncrementFavoriteCount(ctx, photoID, delta)
	r.logOperation("IncrementFavoriteCount", photoID, start, err)
	return err
}

// IncrementDownloadCount logs download count increment operations.
func (r *LoggingPhotoRepository) IncrementDownloadCount(ctx context.Context, photoID string) error {
	start := time.Now()
	err := r.repo.IncrementDownloadCount(ctx, photoID)
	r.logOperation("IncrementDownloadCount", photoID, start, err)
	return err
}

func (r *LoggingPhotoRepository) logOperation(operation, identifier string, start time.Time, err error) {
	duration := time.Since(start)
	fields := map[string]interface{}{
		"repository": "photo",
		"operation":  operation,
		"identifier": identifier,
		"duration":   duration.String(),
		"durationMs": duration.Milliseconds(),
	}

	if err != nil {
		fields["error"] = err.Error()
		logger.Error("Repository operation failed", fields)
	} else {
		logger.Debug("Repository operation completed", fields)
	}
}
