package handlers

import (
	"encoding/json"
	"net/http"

	"photographer-gallery/backend/internal/domain/auth"
	"photographer-gallery/backend/internal/domain/gallery"
	"photographer-gallery/backend/internal/domain/photo"
	"photographer-gallery/backend/pkg/errors"
)

// ClientHandler handles client-facing HTTP requests
type ClientHandler struct {
	galleryService *gallery.Service
	photoService   *photo.Service
	sessionService *auth.SessionService
}

// NewClientHandler creates a new client handler
func NewClientHandler(
	galleryService *gallery.Service,
	photoService *photo.Service,
	sessionService *auth.SessionService,
) *ClientHandler {
	return &ClientHandler{
		galleryService: galleryService,
		photoService:   photoService,
		sessionService: sessionService,
	}
}

// VerifyPasswordRequest represents the password verification request
type VerifyPasswordRequest struct {
	CustomURL string `json:"customUrl"`
	Password  string `json:"password"`
}

// VerifyPassword handles POST /client/verify
func (h *ClientHandler) VerifyPassword(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req VerifyPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, errors.NewBadRequest("Invalid request body"))
		return
	}

	if req.CustomURL == "" {
		respondError(w, errors.NewBadRequest("customUrl is required"))
		return
	}
	if req.Password == "" {
		respondError(w, errors.NewBadRequest("password is required"))
		return
	}

	// Verify gallery password
	g, err := h.galleryService.VerifyPassword(ctx, req.CustomURL, req.Password)
	if err != nil {
		respondError(w, err)
		return
	}

	// Get client info from request
	ipAddress := r.Header.Get("X-Forwarded-For")
	if ipAddress == "" {
		ipAddress = r.RemoteAddr
	}
	userAgent := r.Header.Get("User-Agent")

	// Create session
	sessionToken, err := h.sessionService.CreateSession(ctx, g.GalleryID, ipAddress, userAgent)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"sessionToken": sessionToken,
		"gallery":      g,
	})
}

// GetGallery handles GET /client/galleries/:customUrl
func (h *ClientHandler) GetGallery(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	customURL := getURLParam(r, "customUrl")

	// Session should be verified by middleware
	g, err := h.galleryService.GetByCustomURL(ctx, customURL)
	if err != nil {
		respondError(w, err)
		return
	}

	// Don't expose password
	g.Password = ""

	respondJSON(w, http.StatusOK, g)
}

// ListPhotos handles GET /client/galleries/:customUrl/photos
func (h *ClientHandler) ListPhotos(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get gallery ID from session context (set by middleware)
	galleryID, ok := ctx.Value("galleryID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("Gallery ID not found in session"))
		return
	}

	limit := 50 // default
	var lastKey map[string]interface{}

	photos, nextKey, err := h.photoService.ListByGallery(ctx, galleryID, limit, lastKey)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"photos":  photos,
		"lastKey": nextKey,
	})
}

// GetDownloadURL handles GET /client/photos/:photoId/download-url
func (h *ClientHandler) GetDownloadURL(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	photoID := getURLParam(r, "photoId")

	url, err := h.photoService.GetDownloadURL(ctx, photoID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"downloadUrl": url,
	})
}

// ToggleFavorite handles POST /client/photos/:photoId/favorite
func (h *ClientHandler) ToggleFavorite(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	photoID := getURLParam(r, "photoId")

	// Get session info from context (set by middleware)
	galleryID, ok := ctx.Value("galleryID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("Gallery ID not found in session"))
		return
	}
	sessionID, ok := ctx.Value("sessionID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("Session ID not found"))
		return
	}

	favorited, err := h.photoService.ToggleFavorite(ctx, galleryID, sessionID, photoID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"isFavorited": favorited,
	})
}

// GetSessionFavorites handles GET /client/session/favorites
func (h *ClientHandler) GetSessionFavorites(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get session info from context
	galleryID, ok := ctx.Value("galleryID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("Gallery ID not found in session"))
		return
	}
	sessionID, ok := ctx.Value("sessionID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("Session ID not found"))
		return
	}

	favorites, err := h.photoService.ListFavoritesBySession(ctx, galleryID, sessionID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"favorites": favorites,
	})
}
