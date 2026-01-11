package analytics

import (
	"context"

	"photographer-gallery/backend/internal/repository"
	"photographer-gallery/backend/pkg/events"
	"photographer-gallery/backend/pkg/logger"
)

// EventHandler handles analytics-related events
type EventHandler struct {
	photographerRepo PhotographerAnalyticsRepo
	galleryRepo      GalleryAnalyticsRepo
}

// PhotographerAnalyticsRepo defines the analytics methods needed for photographer
type PhotographerAnalyticsRepo interface {
	IncrementTotalViews(ctx context.Context, userID string, delta int64) error
	IncrementTotalDownloads(ctx context.Context, userID string, delta int64) error
	IncrementTotalFavorites(ctx context.Context, userID string, delta int) error
	IncrementTotalGalleries(ctx context.Context, userID string, delta int) error
	IncrementTotalPhotos(ctx context.Context, userID string, delta int) error
	IncrementTotalClients(ctx context.Context, userID string, delta int64) error
	IncrementActiveGalleries(ctx context.Context, userID string, delta int) error
}

// GalleryAnalyticsRepo defines the analytics methods needed for gallery
type GalleryAnalyticsRepo interface {
	GetByID(ctx context.Context, galleryID string) (*repository.Gallery, error)
	IncrementViewCount(ctx context.Context, galleryID string, delta int64) error
	IncrementDownloadCount(ctx context.Context, galleryID string, delta int64) error
	IncrementFavoriteCount(ctx context.Context, galleryID string, delta int) error
	IncrementUniqueClients(ctx context.Context, galleryID string) error
	UpdateLastClientAccess(ctx context.Context, galleryID string) error
}

// NewEventHandler creates a new analytics event handler
func NewEventHandler(
	photographerRepo PhotographerAnalyticsRepo,
	galleryRepo GalleryAnalyticsRepo,
) *EventHandler {
	return &EventHandler{
		photographerRepo: photographerRepo,
		galleryRepo:      galleryRepo,
	}
}

// RegisterHandlers subscribes to relevant events on the event bus
func (h *EventHandler) RegisterHandlers(bus events.EventBus) {
	bus.Subscribe(events.PhotoUploaded, h.handlePhotoUploaded)
	bus.Subscribe(events.PhotoDeleted, h.handlePhotoDeleted)
	bus.Subscribe(events.GalleryCreated, h.handleGalleryCreated)
	bus.Subscribe(events.GalleryDeleted, h.handleGalleryDeleted)
	bus.Subscribe(events.FavoriteToggled, h.handleFavoriteToggled)
	bus.Subscribe(events.PhotoDownloaded, h.handlePhotoDownloaded)
	bus.Subscribe(events.ClientSessionCreated, h.handleSessionCreated)
}

// handlePhotoUploaded increments photo counts
func (h *EventHandler) handlePhotoUploaded(ctx context.Context, event events.Event) error {
	payload, ok := event.Payload().(*events.PhotoUploadedPayload)
	if !ok {
		return nil
	}

	gallery, err := h.galleryRepo.GetByID(ctx, payload.GalleryID)
	if err != nil || gallery == nil {
		logger.Error("Failed to get gallery for photo upload analytics", map[string]interface{}{
			"galleryId": payload.GalleryID,
			"error":     err,
		})
		return nil // Don't fail the upload for analytics errors
	}

	// Increment photographer's total photos
	if err := h.photographerRepo.IncrementTotalPhotos(ctx, gallery.PhotographerID, 1); err != nil {
		logger.Error("Failed to increment total photos", map[string]interface{}{
			"photographerId": gallery.PhotographerID,
			"error":          err,
		})
	}

	return nil
}

// handlePhotoDeleted decrements photo counts
func (h *EventHandler) handlePhotoDeleted(ctx context.Context, event events.Event) error {
	payload, ok := event.Payload().(*events.PhotoUploadedPayload) // Reusing same payload structure
	if !ok {
		return nil
	}

	gallery, err := h.galleryRepo.GetByID(ctx, payload.GalleryID)
	if err != nil || gallery == nil {
		return nil
	}

	// Decrement photographer's total photos
	if err := h.photographerRepo.IncrementTotalPhotos(ctx, gallery.PhotographerID, -1); err != nil {
		logger.Error("Failed to decrement total photos", map[string]interface{}{
			"photographerId": gallery.PhotographerID,
			"error":          err,
		})
	}

	return nil
}

// handleGalleryCreated increments gallery counts
func (h *EventHandler) handleGalleryCreated(ctx context.Context, event events.Event) error {
	payload, ok := event.Payload().(*events.GalleryCreatedPayload)
	if !ok {
		return nil
	}

	// Increment total galleries
	if err := h.photographerRepo.IncrementTotalGalleries(ctx, payload.PhotographerID, 1); err != nil {
		logger.Error("Failed to increment total galleries", map[string]interface{}{
			"photographerId": payload.PhotographerID,
			"error":          err,
		})
	}

	// Increment active galleries
	if err := h.photographerRepo.IncrementActiveGalleries(ctx, payload.PhotographerID, 1); err != nil {
		logger.Error("Failed to increment active galleries", map[string]interface{}{
			"photographerId": payload.PhotographerID,
			"error":          err,
		})
	}

	return nil
}

// handleGalleryDeleted decrements gallery counts
func (h *EventHandler) handleGalleryDeleted(ctx context.Context, event events.Event) error {
	payload, ok := event.Payload().(*events.GalleryDeletedPayload)
	if !ok {
		return nil
	}

	// Decrement total galleries
	if err := h.photographerRepo.IncrementTotalGalleries(ctx, payload.PhotographerID, -1); err != nil {
		logger.Error("Failed to decrement total galleries", map[string]interface{}{
			"photographerId": payload.PhotographerID,
			"error":          err,
		})
	}

	// Decrement active galleries
	if err := h.photographerRepo.IncrementActiveGalleries(ctx, payload.PhotographerID, -1); err != nil {
		logger.Error("Failed to decrement active galleries", map[string]interface{}{
			"photographerId": payload.PhotographerID,
			"error":          err,
		})
	}

	// Decrement total photos by the count of photos in the deleted gallery
	if payload.PhotoCount > 0 {
		if err := h.photographerRepo.IncrementTotalPhotos(ctx, payload.PhotographerID, -payload.PhotoCount); err != nil {
			logger.Error("Failed to decrement total photos on gallery delete", map[string]interface{}{
				"photographerId": payload.PhotographerID,
				"photoCount":     payload.PhotoCount,
				"error":          err,
			})
		}
	}

	return nil
}

// handleFavoriteToggled updates favorite counts
func (h *EventHandler) handleFavoriteToggled(ctx context.Context, event events.Event) error {
	payload, ok := event.Payload().(*events.FavoriteToggledPayload)
	if !ok {
		return nil
	}

	gallery, err := h.galleryRepo.GetByID(ctx, payload.GalleryID)
	if err != nil || gallery == nil {
		return nil
	}

	delta := 1
	if !payload.Favorited {
		delta = -1
	}

	// Update gallery favorite count
	if err := h.galleryRepo.IncrementFavoriteCount(ctx, payload.GalleryID, delta); err != nil {
		logger.Error("Failed to update gallery favorite count", map[string]interface{}{
			"galleryId": payload.GalleryID,
			"error":     err,
		})
	}

	// Update photographer total favorites
	if err := h.photographerRepo.IncrementTotalFavorites(ctx, gallery.PhotographerID, delta); err != nil {
		logger.Error("Failed to update photographer total favorites", map[string]interface{}{
			"photographerId": gallery.PhotographerID,
			"error":          err,
		})
	}

	return nil
}

// handlePhotoDownloaded updates download counts
func (h *EventHandler) handlePhotoDownloaded(ctx context.Context, event events.Event) error {
	payload, ok := event.Payload().(*events.PhotoDownloadedPayload)
	if !ok {
		return nil
	}

	// Update gallery download count
	if err := h.galleryRepo.IncrementDownloadCount(ctx, payload.GalleryID, 1); err != nil {
		logger.Error("Failed to update gallery download count", map[string]interface{}{
			"galleryId": payload.GalleryID,
			"error":     err,
		})
	}

	// Update photographer total downloads
	if err := h.photographerRepo.IncrementTotalDownloads(ctx, payload.PhotographerID, 1); err != nil {
		logger.Error("Failed to update photographer total downloads", map[string]interface{}{
			"photographerId": payload.PhotographerID,
			"error":          err,
		})
	}

	return nil
}

// handleSessionCreated updates client counts
func (h *EventHandler) handleSessionCreated(ctx context.Context, event events.Event) error {
	payload, ok := event.Payload().(*events.ClientSessionCreatedPayload)
	if !ok {
		return nil
	}

	// Update gallery unique clients
	if err := h.galleryRepo.IncrementUniqueClients(ctx, payload.GalleryID); err != nil {
		logger.Error("Failed to update gallery unique clients", map[string]interface{}{
			"galleryId": payload.GalleryID,
			"error":     err,
		})
	}

	// Update gallery last client access
	if err := h.galleryRepo.UpdateLastClientAccess(ctx, payload.GalleryID); err != nil {
		logger.Error("Failed to update gallery last client access", map[string]interface{}{
			"galleryId": payload.GalleryID,
			"error":     err,
		})
	}

	// Update photographer total clients
	if err := h.photographerRepo.IncrementTotalClients(ctx, payload.PhotographerID, 1); err != nil {
		logger.Error("Failed to update photographer total clients", map[string]interface{}{
			"photographerId": payload.PhotographerID,
			"error":          err,
		})
	}

	return nil
}
