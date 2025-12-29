package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"photographer-gallery/backend/internal/domain/photographer"
	"photographer-gallery/backend/pkg/logger"
)

type AuthHandler struct {
	photographerRepo PhotographerRepository
}

type PhotographerRepository interface {
	GetByID(ctx context.Context, userID string) (*photographer.Photographer, error)
	GetByEmail(ctx context.Context, email string) (*photographer.Photographer, error)
	Create(ctx context.Context, p *photographer.Photographer) error
	Update(ctx context.Context, p *photographer.Photographer) error
}

func NewAuthHandler(photographerRepo PhotographerRepository) *AuthHandler {
	return &AuthHandler{
		photographerRepo: photographerRepo,
	}
}

// GetMe returns the current authenticated user's profile
func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (set by auth middleware)
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		logger.Error("No user ID in context", nil)
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get email from context (from Cognito JWT)
	email, _ := r.Context().Value("email").(string)
	name, _ := r.Context().Value("name").(string)

	// Try to get photographer from database
	p, err := h.photographerRepo.GetByID(r.Context(), userID)

	// If photographer doesn't exist, create them (first time login)
	if err == photographer.ErrNotFound {
		logger.Info("Creating new photographer profile", map[string]interface{}{
			"userID": userID,
			"email":  email,
		})

		// Create new photographer with defaults
		p = &photographer.Photographer{
			UserID:      userID,
			Email:       email,
			Name:        name,
			Provider:    "cognito",
			StorageUsed: 0,
			Plan:        "free",
		}

		if err := h.photographerRepo.Create(r.Context(), p); err != nil {
			logger.Error("Failed to create photographer", map[string]interface{}{
				"error": err.Error(),
			})
			respondWithError(w, http.StatusInternalServerError, "Failed to create user profile")
			return
		}
	} else if err != nil {
		logger.Error("Failed to get photographer", map[string]interface{}{
			"error": err.Error(),
		})
		respondWithError(w, http.StatusInternalServerError, "Failed to get user profile")
		return
	}

	// Return photographer profile
	respondWithJSON(w, http.StatusOK, p)
}

// Helper functions
func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error": "Failed to marshal response"}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"error": message})
}
