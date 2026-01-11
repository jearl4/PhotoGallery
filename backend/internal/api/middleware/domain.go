package middleware

import (
	"context"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"photographer-gallery/backend/internal/domain/customdomain"
	"photographer-gallery/backend/internal/domain/photographer"
	"photographer-gallery/backend/pkg/logger"
)

// DomainMiddleware resolves photographer from the request hostname
type DomainMiddleware struct {
	domainService *customdomain.Service
	baseDomain    string
}

// NewDomainMiddleware creates a new domain middleware
func NewDomainMiddleware(domainService *customdomain.Service, baseDomain string) *DomainMiddleware {
	return &DomainMiddleware{
		domainService: domainService,
		baseDomain:    baseDomain,
	}
}

// ResolvePhotographer extracts the photographer from the request hostname
// It checks the Host header (or X-Forwarded-Host for requests through CloudFront)
// and resolves the photographer based on subdomain or custom domain
func (m *DomainMiddleware) ResolvePhotographer(ctx context.Context, req events.APIGatewayProxyRequest) (context.Context, error) {
	// Get host from headers (try multiple header names for compatibility)
	host := m.getHost(req)
	if host == "" {
		logger.Debug("No host header found", nil)
		return ctx, nil
	}

	// Clean up the host
	host = strings.ToLower(strings.TrimSpace(host))
	host = strings.Split(host, ":")[0] // Remove port if present

	logger.Debug("Resolving photographer from host", map[string]interface{}{
		"host":       host,
		"baseDomain": m.baseDomain,
	})

	// Check if this is the main domain (not a custom domain)
	if m.isMainDomain(host) {
		logger.Debug("Main domain detected, skipping photographer resolution", nil)
		return ctx, nil
	}

	// Try to resolve photographer from the host
	p, err := m.domainService.ResolvePhotographerByHost(ctx, host)
	if err != nil {
		if err == photographer.ErrNotFound {
			logger.Debug("No photographer found for host", map[string]interface{}{"host": host})
			return ctx, nil
		}
		logger.Error("Failed to resolve photographer from host", map[string]interface{}{
			"host":  host,
			"error": err.Error(),
		})
		return ctx, nil // Don't fail the request, just don't set photographer context
	}

	// Add photographer info to context
	ctx = context.WithValue(ctx, "photographerID", p.UserID)
	ctx = context.WithValue(ctx, "isCustomDomain", true)
	ctx = context.WithValue(ctx, "resolvedHost", host)

	logger.Info("Photographer resolved from custom domain", map[string]interface{}{
		"photographerId": p.UserID,
		"host":           host,
	})

	return ctx, nil
}

// getHost extracts the host from request headers
func (m *DomainMiddleware) getHost(req events.APIGatewayProxyRequest) string {
	// Check X-Forwarded-Host first (set by CloudFront/Lambda@Edge)
	if host := req.Headers["X-Forwarded-Host"]; host != "" {
		return host
	}
	if host := req.Headers["x-forwarded-host"]; host != "" {
		return host
	}

	// Fall back to Host header
	if host := req.Headers["Host"]; host != "" {
		return host
	}
	if host := req.Headers["host"]; host != "" {
		return host
	}

	return ""
}

// isMainDomain checks if the host is the main application domain
func (m *DomainMiddleware) isMainDomain(host string) bool {
	// Exact match
	if host == m.baseDomain {
		return true
	}

	// www subdomain
	if host == "www."+m.baseDomain {
		return true
	}

	// Localhost for development
	if strings.HasPrefix(host, "localhost") {
		return true
	}

	// API Gateway domains
	if strings.Contains(host, ".execute-api.") {
		return true
	}

	// CloudFront domains
	if strings.HasSuffix(host, ".cloudfront.net") {
		return true
	}

	return false
}

// IsCustomDomainRequest checks if the request came from a custom domain
func IsCustomDomainRequest(ctx context.Context) bool {
	isCustomDomain, ok := ctx.Value("isCustomDomain").(bool)
	return ok && isCustomDomain
}

// GetPhotographerIDFromDomain returns the photographer ID if resolved from domain
func GetPhotographerIDFromDomain(ctx context.Context) (string, bool) {
	photographerID, ok := ctx.Value("photographerID").(string)
	return photographerID, ok
}
