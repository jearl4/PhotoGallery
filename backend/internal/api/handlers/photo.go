package handlers

import (
	"encoding/json"
	"net/http"

	"photographer-gallery/backend/internal/domain/photo"
	"photographer-gallery/backend/pkg/errors"
)

// PhotoHandler handles photo-related HTTP requests
type PhotoHandler struct {
	photoService *photo.Service
}

// NewPhotoHandler creates a new photo handler
func NewPhotoHandler(photoService *photo.Service) *PhotoHandler {
	return &PhotoHandler{
		photoService: photoService,
	}
}

// GetUploadURLRequest represents the upload URL request
type GetUploadURLRequest struct {
	FileName string `json:"fileName"`
	MimeType string `json:"mimeType"`
}

// GetUploadURL handles POST /galleries/:id/photos/upload-url
func (h *PhotoHandler) GetUploadURL(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	galleryID := getURLParam(r, "id")

	var req GetUploadURLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, errors.NewBadRequest("Invalid request body"))
		return
	}

	if req.FileName == "" {
		respondError(w, errors.NewBadRequest("fileName is required"))
		return
	}
	if req.MimeType == "" {
		respondError(w, errors.NewBadRequest("mimeType is required"))
		return
	}

	resp, err := h.photoService.GenerateUploadURL(ctx, photo.UploadURLRequest{
		GalleryID: galleryID,
		FileName:  req.FileName,
		MimeType:  req.MimeType,
	})

	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, resp)
}

// ListPhotos handles GET /galleries/:id/photos
func (h *PhotoHandler) ListPhotos(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	galleryID := getURLParam(r, "id")

	limit := 50 // default
	var lastKey map[string]interface{}

	photos, nextKey, err := h.photoService.ListByGallery(ctx, galleryID, limit, lastKey)
	if err != nil {
		respondError(w, err)
		return
	}

	response := map[string]interface{}{
		"photos":  photos,
		"lastKey": nextKey,
	}

	respondJSON(w, http.StatusOK, response)
}

// DeletePhoto handles DELETE /galleries/:galleryId/photos/:photoId
func (h *PhotoHandler) DeletePhoto(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	photoID := getURLParam(r, "photoId")

	if err := h.photoService.Delete(ctx, photoID); err != nil {
		respondError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetFavorites handles GET /galleries/:id/favorites
func (h *PhotoHandler) GetFavorites(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	galleryID := getURLParam(r, "id")

	favorites, err := h.photoService.ListFavoritesByGallery(ctx, galleryID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"favorites": favorites,
	})
}
