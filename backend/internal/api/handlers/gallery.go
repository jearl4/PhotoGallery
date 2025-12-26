package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"photographer-gallery/backend/internal/domain/gallery"
	"photographer-gallery/backend/pkg/errors"
	"photographer-gallery/backend/pkg/logger"
)

// GalleryHandler handles gallery-related HTTP requests
type GalleryHandler struct {
	galleryService *gallery.Service
}

// NewGalleryHandler creates a new gallery handler
func NewGalleryHandler(galleryService *gallery.Service) *GalleryHandler {
	return &GalleryHandler{
		galleryService: galleryService,
	}
}

// CreateGalleryRequest represents the HTTP request body
type CreateGalleryRequest struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	CustomURL   string  `json:"customUrl"`
	Password    string  `json:"password"`
	ExpiresAt   *string `json:"expiresAt,omitempty"`
}

// CreateGallery handles POST /galleries
func (h *GalleryHandler) CreateGallery(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get photographer ID from context (set by auth middleware)
	photographerID, ok := ctx.Value("userID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("User ID not found"))
		return
	}

	var req CreateGalleryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, errors.NewBadRequest("Invalid request body"))
		return
	}

	// Validate request
	if req.Name == "" {
		respondError(w, errors.NewBadRequest("Name is required"))
		return
	}
	if req.Password == "" {
		respondError(w, errors.NewBadRequest("Password is required"))
		return
	}

	// Parse expiration date
	var expiresAt *time.Time
	if req.ExpiresAt != nil {
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			respondError(w, errors.NewBadRequest("Invalid expiration date format"))
			return
		}
		expiresAt = &t
	}

	// Create gallery
	g, err := h.galleryService.Create(ctx, gallery.CreateGalleryRequest{
		PhotographerID: photographerID,
		Name:           req.Name,
		Description:    req.Description,
		CustomURL:      req.CustomURL,
		Password:       req.Password,
		ExpiresAt:      expiresAt,
	})

	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, g)
}

// GetGallery handles GET /galleries/:id
func (h *GalleryHandler) GetGallery(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	galleryID := getURLParam(r, "id")

	g, err := h.galleryService.GetByID(ctx, galleryID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, g)
}

// ListGalleries handles GET /galleries
func (h *GalleryHandler) ListGalleries(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	photographerID, ok := ctx.Value("userID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("User ID not found"))
		return
	}

	limit := 20 // default limit
	var lastKey map[string]interface{}

	galleries, nextKey, err := h.galleryService.ListByPhotographer(ctx, photographerID, limit, lastKey)
	if err != nil {
		respondError(w, err)
		return
	}

	response := map[string]interface{}{
		"galleries": galleries,
		"lastKey":   nextKey,
	}

	respondJSON(w, http.StatusOK, response)
}

// UpdateGalleryRequest represents the update request
type UpdateGalleryRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	Password    *string `json:"password,omitempty"`
	ExpiresAt   *string `json:"expiresAt,omitempty"`
}

// UpdateGallery handles PUT /galleries/:id
func (h *GalleryHandler) UpdateGallery(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	galleryID := getURLParam(r, "id")

	var req UpdateGalleryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, errors.NewBadRequest("Invalid request body"))
		return
	}

	updateReq := gallery.UpdateGalleryRequest{
		Name:        req.Name,
		Description: req.Description,
		Password:    req.Password,
	}

	if req.ExpiresAt != nil {
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			respondError(w, errors.NewBadRequest("Invalid expiration date format"))
			return
		}
		updateReq.ExpiresAt = &t
	}

	g, err := h.galleryService.Update(ctx, galleryID, updateReq)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, g)
}

// DeleteGallery handles DELETE /galleries/:id
func (h *GalleryHandler) DeleteGallery(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	galleryID := getURLParam(r, "id")

	if err := h.galleryService.Delete(ctx, galleryID); err != nil {
		respondError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// SetExpirationRequest represents the expiration request
type SetExpirationRequest struct {
	ExpiresAt *string `json:"expiresAt"`
}

// SetExpiration handles POST /galleries/:id/expire
func (h *GalleryHandler) SetExpiration(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	galleryID := getURLParam(r, "id")

	var req SetExpirationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, errors.NewBadRequest("Invalid request body"))
		return
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil {
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			respondError(w, errors.NewBadRequest("Invalid expiration date format"))
			return
		}
		expiresAt = &t
	}

	g, err := h.galleryService.SetExpiration(ctx, galleryID, expiresAt)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, g)
}

// Helper functions
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, err error) {
	if appErr, ok := err.(*errors.AppError); ok {
		respondJSON(w, appErr.Code, appErr)
	} else {
		logger.Error("Unexpected error", map[string]interface{}{"error": err.Error()})
		respondJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Internal server error",
		})
	}
}

func getURLParam(r *http.Request, param string) string {
	// This is a placeholder - actual implementation depends on router
	// For API Gateway Lambda, you'd get this from the path parameters
	return r.Context().Value(param).(string)
}
