package customdomain

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"regexp"
	"strings"

	"photographer-gallery/backend/internal/domain/photographer"
)

// PhotographerRepository defines the interface for photographer data access
type PhotographerRepository interface {
	GetByID(ctx context.Context, userID string) (*photographer.Photographer, error)
	GetBySubdomain(ctx context.Context, subdomain string) (*photographer.Photographer, error)
	GetByCustomDomain(ctx context.Context, domain string) (*photographer.Photographer, error)
	UpdateDomain(ctx context.Context, userID string, subdomain, customDomain, domainStatus, verificationToken, certificateArn string) error
	ClearDomain(ctx context.Context, userID string) error
}

// Service handles custom domain operations
type Service struct {
	photographerRepo PhotographerRepository
	baseDomain       string // e.g., "photographergallery.com"
}

// NewService creates a new domain service
func NewService(photographerRepo PhotographerRepository, baseDomain string) *Service {
	return &Service{
		photographerRepo: photographerRepo,
		baseDomain:       baseDomain,
	}
}

// Validation patterns
var (
	subdomainPattern    = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$`)
	customDomainPattern = regexp.MustCompile(`^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$`)
)

// GetDomainConfig returns the current domain configuration for a photographer
func (s *Service) GetDomainConfig(ctx context.Context, userID string) (*DomainConfig, error) {
	p, err := s.photographerRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	config := &DomainConfig{}

	if p.Subdomain != "" {
		config.Type = TypeSubdomain
		config.Subdomain = p.Subdomain
		config.FullDomain = fmt.Sprintf("%s.%s", p.Subdomain, s.baseDomain)
		config.Status = StatusActive // Subdomains are immediately active
	}

	if p.CustomDomain != "" {
		config.Type = TypeCustomDomain
		config.CustomDomain = p.CustomDomain
		config.FullDomain = p.CustomDomain
		config.Status = DomainStatus(p.DomainStatus)
		config.VerifiedAt = p.DomainVerifiedAt

		// If pending verification, include the token for display
		if p.DomainStatus == string(StatusPendingVerification) {
			config.VerificationToken = p.VerificationToken
			config.DNSInstructions = s.getVerificationInstructions(p.CustomDomain, p.VerificationToken)
		}
	}

	return config, nil
}

// RequestSubdomain claims a subdomain for the photographer
func (s *Service) RequestSubdomain(ctx context.Context, userID, subdomain string) (*DomainConfig, error) {
	// Normalize subdomain
	subdomain = strings.ToLower(strings.TrimSpace(subdomain))

	// Validate format
	if !subdomainPattern.MatchString(subdomain) || len(subdomain) < 3 || len(subdomain) > 63 {
		return nil, ErrSubdomainInvalid
	}

	// Check if reserved
	if IsReservedSubdomain(subdomain) {
		return nil, ErrSubdomainReserved
	}

	// Check if already taken by another user
	existing, err := s.photographerRepo.GetBySubdomain(ctx, subdomain)
	if err != nil && err != photographer.ErrNotFound {
		return nil, fmt.Errorf("failed to check subdomain availability: %w", err)
	}
	if existing != nil && existing.UserID != userID {
		return nil, ErrSubdomainTaken
	}

	// Update the photographer's subdomain
	err = s.photographerRepo.UpdateDomain(ctx, userID, subdomain, "", "", "", "")
	if err != nil {
		return nil, fmt.Errorf("failed to claim subdomain: %w", err)
	}

	return &DomainConfig{
		Type:       TypeSubdomain,
		Subdomain:  subdomain,
		FullDomain: fmt.Sprintf("%s.%s", subdomain, s.baseDomain),
		Status:     StatusActive,
	}, nil
}

// RequestCustomDomain initiates the custom domain setup process
func (s *Service) RequestCustomDomain(ctx context.Context, userID, domain string) (*DomainConfig, error) {
	// Normalize domain
	domain = strings.ToLower(strings.TrimSpace(domain))
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "www.")
	domain = strings.TrimSuffix(domain, "/")

	// Validate format
	if !customDomainPattern.MatchString(domain) {
		return nil, ErrCustomDomainInvalid
	}

	// Prevent using the base domain or its subdomains
	if domain == s.baseDomain || strings.HasSuffix(domain, "."+s.baseDomain) {
		return nil, ErrCustomDomainInvalid
	}

	// Check if already taken by another user
	existing, err := s.photographerRepo.GetByCustomDomain(ctx, domain)
	if err != nil && err != photographer.ErrNotFound {
		return nil, fmt.Errorf("failed to check domain availability: %w", err)
	}
	if existing != nil && existing.UserID != userID {
		return nil, ErrCustomDomainTaken
	}

	// Generate verification token
	token, err := generateVerificationToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate verification token: %w", err)
	}

	// Update the photographer's custom domain
	err = s.photographerRepo.UpdateDomain(ctx, userID, "", domain, string(StatusPendingVerification), token, "")
	if err != nil {
		return nil, fmt.Errorf("failed to request custom domain: %w", err)
	}

	return &DomainConfig{
		Type:              TypeCustomDomain,
		CustomDomain:      domain,
		FullDomain:        domain,
		Status:            StatusPendingVerification,
		VerificationToken: token,
		DNSInstructions:   s.getVerificationInstructions(domain, token),
	}, nil
}

// VerifyDomain checks DNS records and verifies domain ownership
func (s *Service) VerifyDomain(ctx context.Context, userID string) (*DomainConfig, error) {
	p, err := s.photographerRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if p.CustomDomain == "" || p.VerificationToken == "" {
		return nil, ErrNoPendingDomain
	}

	if p.DomainStatus == string(StatusActive) {
		return nil, ErrDomainAlreadyActive
	}

	// Check DNS TXT record
	verified, err := s.checkDNSVerification(p.CustomDomain, p.VerificationToken)
	if err != nil {
		return nil, fmt.Errorf("failed to check DNS: %w", err)
	}

	if !verified {
		return &DomainConfig{
			Type:              TypeCustomDomain,
			CustomDomain:      p.CustomDomain,
			FullDomain:        p.CustomDomain,
			Status:            StatusPendingVerification,
			VerificationToken: p.VerificationToken,
			DNSInstructions:   s.getVerificationInstructions(p.CustomDomain, p.VerificationToken),
		}, ErrVerificationFailed
	}

	// Domain verified! Update status to verified (SSL will be handled separately)
	err = s.photographerRepo.UpdateDomain(ctx, userID, "", p.CustomDomain, string(StatusVerified), p.VerificationToken, "")
	if err != nil {
		return nil, fmt.Errorf("failed to update domain status: %w", err)
	}

	return &DomainConfig{
		Type:         TypeCustomDomain,
		CustomDomain: p.CustomDomain,
		FullDomain:   p.CustomDomain,
		Status:       StatusVerified,
	}, nil
}

// RemoveDomain removes the custom domain configuration
func (s *Service) RemoveDomain(ctx context.Context, userID string) error {
	return s.photographerRepo.ClearDomain(ctx, userID)
}

// ResolvePhotographerByHost resolves a photographer from a hostname
func (s *Service) ResolvePhotographerByHost(ctx context.Context, host string) (*photographer.Photographer, error) {
	host = strings.ToLower(strings.TrimSpace(host))
	host = strings.Split(host, ":")[0] // Remove port if present

	// Check if it's a subdomain of our base domain
	if strings.HasSuffix(host, "."+s.baseDomain) {
		subdomain := strings.TrimSuffix(host, "."+s.baseDomain)
		// Ignore www or empty subdomains
		if subdomain == "" || subdomain == "www" {
			return nil, photographer.ErrNotFound
		}
		return s.photographerRepo.GetBySubdomain(ctx, subdomain)
	}

	// Check if it's the base domain itself
	if host == s.baseDomain || host == "www."+s.baseDomain {
		return nil, photographer.ErrNotFound
	}

	// Check if it's a custom domain
	return s.photographerRepo.GetByCustomDomain(ctx, host)
}

// checkDNSVerification checks if the TXT record exists
func (s *Service) checkDNSVerification(domain, expectedToken string) (bool, error) {
	recordName := fmt.Sprintf("_photographergallery-verify.%s", domain)

	txtRecords, err := net.LookupTXT(recordName)
	if err != nil {
		// DNS lookup failed - record doesn't exist yet
		return false, nil
	}

	for _, record := range txtRecords {
		if strings.TrimSpace(record) == expectedToken {
			return true, nil
		}
	}

	return false, nil
}

// getVerificationInstructions returns DNS instructions for domain verification
func (s *Service) getVerificationInstructions(domain, token string) []DNSRecord {
	return []DNSRecord{
		{
			Type:    "TXT",
			Name:    fmt.Sprintf("_photographergallery-verify.%s", domain),
			Value:   token,
			Purpose: "verification",
		},
	}
}

// generateVerificationToken generates a random verification token
func generateVerificationToken() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "pg-verify-" + hex.EncodeToString(bytes), nil
}
