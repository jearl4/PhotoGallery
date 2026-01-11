package handlers

import (
	"encoding/json"
	"net/http"

	"photographer-gallery/backend/internal/domain/customdomain"
	"photographer-gallery/backend/pkg/errors"
	"photographer-gallery/backend/pkg/logger"
)

// DomainHandler handles domain-related HTTP requests
type DomainHandler struct {
	domainService *customdomain.Service
}

// NewDomainHandler creates a new domain handler
func NewDomainHandler(domainService *customdomain.Service) *DomainHandler {
	return &DomainHandler{
		domainService: domainService,
	}
}

// GetDomainConfig handles GET /domain
func (h *DomainHandler) GetDomainConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID, ok := ctx.Value("userID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("User ID not found"))
		return
	}

	config, err := h.domainService.GetDomainConfig(ctx, userID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, config)
}

// RequestSubdomain handles POST /domain/subdomain
func (h *DomainHandler) RequestSubdomain(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID, ok := ctx.Value("userID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("User ID not found"))
		return
	}

	var req customdomain.RequestSubdomainInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, errors.NewBadRequest("Invalid request body"))
		return
	}

	if req.Subdomain == "" {
		respondError(w, errors.NewBadRequest("Subdomain is required"))
		return
	}

	config, err := h.domainService.RequestSubdomain(ctx, userID, req.Subdomain)
	if err != nil {
		switch err {
		case customdomain.ErrSubdomainTaken:
			respondError(w, errors.NewConflict("Subdomain is already taken"))
		case customdomain.ErrSubdomainInvalid:
			respondError(w, errors.NewBadRequest("Subdomain is invalid: must be 3-63 lowercase alphanumeric characters or hyphens"))
		case customdomain.ErrSubdomainReserved:
			respondError(w, errors.NewBadRequest("Subdomain is reserved and cannot be used"))
		default:
			logger.Error("Failed to request subdomain", map[string]interface{}{"error": err.Error()})
			respondError(w, errors.NewInternalServer("Failed to claim subdomain"))
		}
		return
	}

	respondJSON(w, http.StatusCreated, config)
}

// RequestCustomDomain handles POST /domain/custom
func (h *DomainHandler) RequestCustomDomain(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID, ok := ctx.Value("userID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("User ID not found"))
		return
	}

	var req customdomain.RequestCustomDomainInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, errors.NewBadRequest("Invalid request body"))
		return
	}

	if req.Domain == "" {
		respondError(w, errors.NewBadRequest("Domain is required"))
		return
	}

	config, err := h.domainService.RequestCustomDomain(ctx, userID, req.Domain)
	if err != nil {
		switch err {
		case customdomain.ErrCustomDomainTaken:
			respondError(w, errors.NewConflict("Domain is already registered by another user"))
		case customdomain.ErrCustomDomainInvalid:
			respondError(w, errors.NewBadRequest("Domain format is invalid"))
		default:
			logger.Error("Failed to request custom domain", map[string]interface{}{"error": err.Error()})
			respondError(w, errors.NewInternalServer("Failed to request custom domain"))
		}
		return
	}

	respondJSON(w, http.StatusCreated, config)
}

// VerifyDomain handles POST /domain/verify
func (h *DomainHandler) VerifyDomain(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID, ok := ctx.Value("userID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("User ID not found"))
		return
	}

	config, err := h.domainService.VerifyDomain(ctx, userID)
	if err != nil {
		switch err {
		case customdomain.ErrVerificationFailed:
			// Return the config with pending status and instructions
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"verified":        false,
				"message":         "DNS record not found. Please add the TXT record and try again.",
				"dnsInstructions": config.DNSInstructions,
			})
		case customdomain.ErrNoPendingDomain:
			respondError(w, errors.NewBadRequest("No pending domain to verify"))
		case customdomain.ErrDomainAlreadyActive:
			respondError(w, errors.NewBadRequest("Domain is already active"))
		default:
			logger.Error("Failed to verify domain", map[string]interface{}{"error": err.Error()})
			respondError(w, errors.NewInternalServer("Failed to verify domain"))
		}
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"verified": true,
		"message":  "Domain verified successfully!",
		"config":   config,
	})
}

// RemoveDomain handles DELETE /domain
func (h *DomainHandler) RemoveDomain(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID, ok := ctx.Value("userID").(string)
	if !ok {
		respondError(w, errors.NewUnauthorized("User ID not found"))
		return
	}

	if err := h.domainService.RemoveDomain(ctx, userID); err != nil {
		logger.Error("Failed to remove domain", map[string]interface{}{"error": err.Error()})
		respondError(w, errors.NewInternalServer("Failed to remove domain"))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
