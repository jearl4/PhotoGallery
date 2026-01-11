package handlers

import (
	"net/http"

	"photographer-gallery/backend/internal/domain/customdomain"
	"photographer-gallery/backend/internal/domain/gallery"
	"photographer-gallery/backend/internal/domain/photographer"
	"photographer-gallery/backend/pkg/errors"
)

// PortalHandler handles requests when accessed via custom domain
type PortalHandler struct {
	domainService    *customdomain.Service
	galleryService   *gallery.Service
	photographerRepo PhotographerRepository // Uses PhotographerRepository from auth.go
}

// NewPortalHandler creates a new portal handler
func NewPortalHandler(
	domainService *customdomain.Service,
	galleryService *gallery.Service,
	photographerRepo PhotographerRepository,
) *PortalHandler {
	return &PortalHandler{
		domainService:    domainService,
		galleryService:   galleryService,
		photographerRepo: photographerRepo,
	}
}

// PortalInfoResponse represents the response for portal info
type PortalInfoResponse struct {
	Photographer *PhotographerInfo `json:"photographer"`
	Galleries    []GalleryInfo     `json:"galleries"`
}

// PhotographerInfo represents public photographer information
type PhotographerInfo struct {
	Name string `json:"name"`
}

// GalleryInfo represents public gallery information
type GalleryInfo struct {
	GalleryID   string `json:"galleryId"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CustomURL   string `json:"customUrl"`
	PhotoCount  int    `json:"photoCount"`
}

// GetPortalInfo handles GET /portal/info
// Returns photographer info and public galleries based on the Host header
func (h *PortalHandler) GetPortalInfo(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get photographer ID from context (set by domain middleware)
	photographerID, ok := ctx.Value("photographerID").(string)
	if !ok {
		respondError(w, errors.NewNotFound("Photographer not found for this domain"))
		return
	}

	// Get photographer info
	p, err := h.photographerRepo.GetByID(ctx, photographerID)
	if err != nil {
		if err == photographer.ErrNotFound {
			respondError(w, errors.NewNotFound("Photographer not found"))
		} else {
			respondError(w, errors.NewInternalServer("Failed to load photographer"))
		}
		return
	}

	// Get photographer's active galleries
	galleries, _, err := h.galleryService.ListByPhotographer(ctx, photographerID, 100, nil)
	if err != nil {
		respondError(w, errors.NewInternalServer("Failed to load galleries"))
		return
	}

	// Filter to only active galleries and transform to public format
	publicGalleries := make([]GalleryInfo, 0)
	for _, g := range galleries {
		if g.Status == "active" {
			publicGalleries = append(publicGalleries, GalleryInfo{
				GalleryID:   g.GalleryID,
				Name:        g.Name,
				Description: g.Description,
				CustomURL:   g.CustomURL,
				PhotoCount:  g.PhotoCount,
			})
		}
	}

	response := PortalInfoResponse{
		Photographer: &PhotographerInfo{
			Name: p.Name,
		},
		Galleries: publicGalleries,
	}

	respondJSON(w, http.StatusOK, response)
}

// ListPortalGalleries handles GET /portal/galleries
// Returns public galleries for the photographer resolved from the Host header
func (h *PortalHandler) ListPortalGalleries(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get photographer ID from context (set by domain middleware)
	photographerID, ok := ctx.Value("photographerID").(string)
	if !ok {
		respondError(w, errors.NewNotFound("Photographer not found for this domain"))
		return
	}

	// Get photographer's active galleries
	galleries, _, err := h.galleryService.ListByPhotographer(ctx, photographerID, 100, nil)
	if err != nil {
		respondError(w, errors.NewInternalServer("Failed to load galleries"))
		return
	}

	// Filter to only active galleries and transform to public format
	publicGalleries := make([]GalleryInfo, 0)
	for _, g := range galleries {
		if g.Status == "active" {
			publicGalleries = append(publicGalleries, GalleryInfo{
				GalleryID:   g.GalleryID,
				Name:        g.Name,
				Description: g.Description,
				CustomURL:   g.CustomURL,
				PhotoCount:  g.PhotoCount,
			})
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"galleries": publicGalleries,
	})
}
