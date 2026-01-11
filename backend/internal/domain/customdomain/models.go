package customdomain

import (
	"errors"

	goaway "github.com/TwiN/go-away"
)

var (
	ErrSubdomainTaken       = errors.New("subdomain is already taken")
	ErrSubdomainInvalid     = errors.New("subdomain is invalid: must be 3-63 lowercase alphanumeric characters or hyphens")
	ErrSubdomainReserved    = errors.New("subdomain is reserved")
	ErrCustomDomainTaken    = errors.New("custom domain is already registered")
	ErrCustomDomainInvalid  = errors.New("custom domain format is invalid")
	ErrVerificationFailed   = errors.New("domain verification failed: TXT record not found")
	ErrNoPendingDomain      = errors.New("no pending domain to verify")
	ErrDomainAlreadyActive  = errors.New("domain is already active")
)

// DomainStatus represents the current state of a custom domain
type DomainStatus string

const (
	StatusPendingVerification DomainStatus = "pending_verification"
	StatusVerified            DomainStatus = "verified"
	StatusPendingSSL          DomainStatus = "pending_ssl"
	StatusActive              DomainStatus = "active"
	StatusFailed              DomainStatus = "failed"
)

// DomainType represents the type of custom domain
type DomainType string

const (
	TypeSubdomain    DomainType = "subdomain"
	TypeCustomDomain DomainType = "custom"
)

// DomainConfig represents the current domain configuration for a photographer
type DomainConfig struct {
	Type              DomainType   `json:"type,omitempty"`
	Subdomain         string       `json:"subdomain,omitempty"`
	CustomDomain      string       `json:"customDomain,omitempty"`
	FullDomain        string       `json:"fullDomain,omitempty"` // e.g., "john.photographergallery.com" or "john-photography.com"
	Status            DomainStatus `json:"status,omitempty"`
	VerificationToken string       `json:"verificationToken,omitempty"`
	DNSInstructions   []DNSRecord  `json:"dnsInstructions,omitempty"`
	VerifiedAt        string       `json:"verifiedAt,omitempty"`
}

// DNSRecord represents a DNS record that needs to be configured
type DNSRecord struct {
	Type    string `json:"type"`    // TXT, CNAME, A
	Name    string `json:"name"`    // Record name
	Value   string `json:"value"`   // Record value
	Purpose string `json:"purpose"` // verification, ssl, routing
}

// RequestSubdomainInput represents the input for requesting a subdomain
type RequestSubdomainInput struct {
	Subdomain string `json:"subdomain"`
}

// RequestCustomDomainInput represents the input for requesting a custom domain
type RequestCustomDomainInput struct {
	Domain string `json:"domain"`
}

// Reserved subdomains that cannot be claimed
var reservedSubdomains = map[string]bool{
	"www":      true,
	"api":      true,
	"app":      true,
	"admin":    true,
	"mail":     true,
	"email":    true,
	"support":  true,
	"help":     true,
	"blog":     true,
	"status":   true,
	"cdn":      true,
	"static":   true,
	"assets":   true,
	"images":   true,
	"photos":   true,
	"gallery":  true,
	"portal":   true,
	"login":    true,
	"auth":     true,
	"oauth":    true,
	"signup":   true,
	"register": true,
	"account":  true,
	"billing":  true,
	"payment":  true,
	"checkout": true,
	"test":     true,
	"dev":      true,
	"staging":  true,
	"prod":     true,
}

// IsReservedSubdomain checks if a subdomain is reserved
func IsReservedSubdomain(subdomain string) bool {
	return reservedSubdomains[subdomain]
}

// ErrSubdomainBanned is returned when subdomain contains banned words
var ErrSubdomainBanned = errors.New("subdomain contains inappropriate language")

// ContainsBannedWord checks if the subdomain contains profanity or inappropriate words
// Uses the go-away library which maintains a comprehensive list internally
func ContainsBannedWord(subdomain string) bool {
	return goaway.IsProfane(subdomain)
}
