package photographer

import "errors"

var (
	ErrNotFound = errors.New("photographer not found")
)

type Photographer struct {
	UserID      string `json:"userId" dynamodbav:"userId"`
	Email       string `json:"email" dynamodbav:"email"`
	Name        string `json:"name" dynamodbav:"name"`
	Provider    string `json:"provider" dynamodbav:"provider"` // google, facebook, apple, cognito
	StorageUsed int64  `json:"storageUsed" dynamodbav:"storageUsed"`
	Plan        string `json:"plan" dynamodbav:"plan"` // free, pro
	CreatedAt   string `json:"createdAt" dynamodbav:"createdAt"`
	UpdatedAt   string `json:"updatedAt" dynamodbav:"updatedAt"`

	// Custom domain configuration
	Subdomain         string `json:"subdomain,omitempty" dynamodbav:"subdomain,omitempty"`
	CustomDomain      string `json:"customDomain,omitempty" dynamodbav:"customDomain,omitempty"`
	DomainStatus      string `json:"domainStatus,omitempty" dynamodbav:"domainStatus,omitempty"` // pending_verification, verified, pending_ssl, active
	VerificationToken string `json:"-" dynamodbav:"verificationToken,omitempty"`
	CertificateArn    string `json:"-" dynamodbav:"certificateArn,omitempty"`
	DomainVerifiedAt  string `json:"domainVerifiedAt,omitempty" dynamodbav:"domainVerifiedAt,omitempty"`
}
