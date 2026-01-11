package handlers

import (
	"net/http"
	"strconv"

	"photographer-gallery/backend/internal/domain/analytics"
	"photographer-gallery/backend/pkg/errors"
)

// AnalyticsHandler handles analytics-related HTTP requests
type AnalyticsHandler struct {
	analyticsService *analytics.Service
}

// NewAnalyticsHandler creates a new analytics handler
func NewAnalyticsHandler(analyticsService *analytics.Service) *AnalyticsHandler {
	return &AnalyticsHandler{
		analyticsService: analyticsService,
	}
}

// GetDashboardSummary handles GET /api/v1/analytics/summary
func (h *AnalyticsHandler) GetDashboardSummary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get photographer ID from context (set by auth middleware)
	photographerID, ok := ctx.Value("userID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("User ID not found"))
		return
	}

	summary, err := h.analyticsService.GetDashboardSummary(ctx, photographerID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, summary)
}

// GetGalleriesAnalytics handles GET /api/v1/analytics/galleries
func (h *AnalyticsHandler) GetGalleriesAnalytics(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get photographer ID from context
	photographerID, ok := ctx.Value("userID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("User ID not found"))
		return
	}

	// Parse query parameters
	limit := 20
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	sortBy := r.URL.Query().Get("sortBy")
	if sortBy == "" {
		sortBy = "views"
	}

	galleries, err := h.analyticsService.GetGalleriesAnalytics(ctx, photographerID, limit, sortBy)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, analytics.GalleriesAnalyticsResponse{
		Galleries: galleries,
	})
}

// GetTopPhotos handles GET /api/v1/analytics/photos/top
func (h *AnalyticsHandler) GetTopPhotos(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get photographer ID from context
	photographerID, ok := ctx.Value("userID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("User ID not found"))
		return
	}

	// Parse query parameters
	limit := 10
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	metric := r.URL.Query().Get("metric")
	if metric == "" {
		metric = "favorites"
	}

	photos, err := h.analyticsService.GetTopPhotos(ctx, photographerID, limit, metric)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, analytics.TopPhotosResponse{
		Photos: photos,
	})
}

// GetClientBehavior handles GET /api/v1/analytics/clients
func (h *AnalyticsHandler) GetClientBehavior(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get photographer ID from context
	photographerID, ok := ctx.Value("userID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("User ID not found"))
		return
	}

	behavior, err := h.analyticsService.GetClientBehavior(ctx, photographerID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, behavior)
}
