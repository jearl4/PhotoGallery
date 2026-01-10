// Package gallery provides gallery domain logic including validation.
package gallery

import (
	"context"
	"regexp"
	"time"

	"photographer-gallery/backend/pkg/errors"
)

// Validator defines the interface for validation chain handlers.
type Validator interface {
	SetNext(validator Validator) Validator
	Validate(ctx context.Context, req interface{}) error
}

// BaseValidator provides the base implementation for the validation chain.
type BaseValidator struct {
	next Validator
}

// SetNext sets the next validator in the chain.
func (v *BaseValidator) SetNext(validator Validator) Validator {
	v.next = validator
	return validator
}

// ValidateNext passes validation to the next validator if it exists.
func (v *BaseValidator) ValidateNext(ctx context.Context, req interface{}) error {
	if v.next != nil {
		return v.next.Validate(ctx, req)
	}
	return nil
}

// CustomURLValidator validates the custom URL format.
type CustomURLValidator struct {
	BaseValidator
}

// NewCustomURLValidator creates a new CustomURLValidator.
func NewCustomURLValidator() *CustomURLValidator {
	return &CustomURLValidator{}
}

// Validate checks that the custom URL is valid.
func (v *CustomURLValidator) Validate(ctx context.Context, req interface{}) error {
	createReq, ok := req.(CreateGalleryRequest)
	if !ok {
		return v.ValidateNext(ctx, req)
	}

	if createReq.CustomURL != "" {
		if len(createReq.CustomURL) < 3 || len(createReq.CustomURL) > 100 {
			return errors.NewBadRequest("Custom URL must be between 3 and 100 characters")
		}

		matched, _ := regexp.MatchString("^[a-z0-9-]+$", createReq.CustomURL)
		if !matched {
			return errors.NewBadRequest("Custom URL can only contain lowercase letters, numbers, and hyphens")
		}
	}

	return v.ValidateNext(ctx, req)
}

// PasswordValidator validates the password requirements.
type PasswordValidator struct {
	BaseValidator
	MinLength int
}

// NewPasswordValidator creates a new PasswordValidator.
func NewPasswordValidator(minLength int) *PasswordValidator {
	return &PasswordValidator{MinLength: minLength}
}

// Validate checks that the password meets requirements.
func (v *PasswordValidator) Validate(ctx context.Context, req interface{}) error {
	createReq, ok := req.(CreateGalleryRequest)
	if !ok {
		return v.ValidateNext(ctx, req)
	}

	if createReq.Password == "" {
		return errors.NewBadRequest("Password is required")
	}

	if len(createReq.Password) < v.MinLength {
		return errors.NewBadRequest("Password must be at least " + string(rune(v.MinLength+'0')) + " characters")
	}

	return v.ValidateNext(ctx, req)
}

// NameValidator validates the gallery name.
type NameValidator struct {
	BaseValidator
	MinLength int
	MaxLength int
}

// NewNameValidator creates a new NameValidator.
func NewNameValidator(minLength, maxLength int) *NameValidator {
	return &NameValidator{MinLength: minLength, MaxLength: maxLength}
}

// Validate checks that the name is valid.
func (v *NameValidator) Validate(ctx context.Context, req interface{}) error {
	createReq, ok := req.(CreateGalleryRequest)
	if !ok {
		return v.ValidateNext(ctx, req)
	}

	if createReq.Name == "" {
		return errors.NewBadRequest("Gallery name is required")
	}

	if len(createReq.Name) < v.MinLength || len(createReq.Name) > v.MaxLength {
		return errors.NewBadRequest("Gallery name must be between " + string(rune(v.MinLength+'0')) + " and " + string(rune(v.MaxLength+'0')) + " characters")
	}

	return v.ValidateNext(ctx, req)
}

// ExpirationValidator validates the expiration date.
type ExpirationValidator struct {
	BaseValidator
}

// NewExpirationValidator creates a new ExpirationValidator.
func NewExpirationValidator() *ExpirationValidator {
	return &ExpirationValidator{}
}

// Validate checks that the expiration date is valid.
func (v *ExpirationValidator) Validate(ctx context.Context, req interface{}) error {
	createReq, ok := req.(CreateGalleryRequest)
	if !ok {
		return v.ValidateNext(ctx, req)
	}

	if createReq.ExpiresAt != nil && createReq.ExpiresAt.Before(time.Now()) {
		return errors.NewBadRequest("Expiration date must be in the future")
	}

	return v.ValidateNext(ctx, req)
}

// WatermarkValidator validates watermark settings.
type WatermarkValidator struct {
	BaseValidator
}

// NewWatermarkValidator creates a new WatermarkValidator.
func NewWatermarkValidator() *WatermarkValidator {
	return &WatermarkValidator{}
}

// Validate checks that watermark settings are valid.
func (v *WatermarkValidator) Validate(ctx context.Context, req interface{}) error {
	createReq, ok := req.(CreateGalleryRequest)
	if !ok {
		return v.ValidateNext(ctx, req)
	}

	if createReq.EnableWatermark {
		if createReq.WatermarkText == "" {
			return errors.NewBadRequest("Watermark text is required when watermark is enabled")
		}

		if createReq.WatermarkPosition != "" {
			validPositions := map[string]bool{
				"bottom-right": true,
				"bottom-left":  true,
				"center":       true,
			}
			if !validPositions[createReq.WatermarkPosition] {
				return errors.NewBadRequest("Invalid watermark position")
			}
		}
	}

	return v.ValidateNext(ctx, req)
}

// ValidationChain creates a complete validation chain for gallery creation.
func NewCreateGalleryValidationChain() Validator {
	name := NewNameValidator(1, 200)
	password := NewPasswordValidator(6)
	customURL := NewCustomURLValidator()
	expiration := NewExpirationValidator()
	watermark := NewWatermarkValidator()

	// Build the chain
	name.SetNext(password).SetNext(customURL).SetNext(expiration).SetNext(watermark)

	return name
}

// ValidateCreateRequest validates a create gallery request.
func ValidateCreateRequest(ctx context.Context, req CreateGalleryRequest) error {
	chain := NewCreateGalleryValidationChain()
	return chain.Validate(ctx, req)
}
