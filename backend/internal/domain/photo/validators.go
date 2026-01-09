// Package photo provides photo domain logic including validation.
package photo

import (
	"context"
	"path"
	"strings"

	"photographer-gallery/backend/pkg/errors"
)

// UploadRequest represents a request to upload a photo.
type UploadRequest struct {
	GalleryID   string
	FileName    string
	ContentType string
	Size        int64
}

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

// FileTypeValidator validates that the file is an allowed image type.
type FileTypeValidator struct {
	BaseValidator
	AllowedTypes []string
}

// NewFileTypeValidator creates a new FileTypeValidator with default allowed types.
func NewFileTypeValidator() *FileTypeValidator {
	return &FileTypeValidator{
		AllowedTypes: []string{
			"image/jpeg",
			"image/png",
			"image/gif",
			"image/webp",
			"image/heic",
			"image/heif",
		},
	}
}

// Validate checks that the file type is allowed.
func (v *FileTypeValidator) Validate(ctx context.Context, req interface{}) error {
	uploadReq, ok := req.(UploadRequest)
	if !ok {
		return v.ValidateNext(ctx, req)
	}

	contentType := strings.ToLower(uploadReq.ContentType)
	allowed := false
	for _, t := range v.AllowedTypes {
		if t == contentType {
			allowed = true
			break
		}
	}

	if !allowed {
		return errors.NewBadRequest("File type not allowed. Allowed types: JPEG, PNG, GIF, WebP, HEIC")
	}

	return v.ValidateNext(ctx, req)
}

// FileExtensionValidator validates that the file extension matches an image type.
type FileExtensionValidator struct {
	BaseValidator
	AllowedExtensions []string
}

// NewFileExtensionValidator creates a new FileExtensionValidator with default extensions.
func NewFileExtensionValidator() *FileExtensionValidator {
	return &FileExtensionValidator{
		AllowedExtensions: []string{
			".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif",
		},
	}
}

// Validate checks that the file extension is allowed.
func (v *FileExtensionValidator) Validate(ctx context.Context, req interface{}) error {
	uploadReq, ok := req.(UploadRequest)
	if !ok {
		return v.ValidateNext(ctx, req)
	}

	ext := strings.ToLower(path.Ext(uploadReq.FileName))
	allowed := false
	for _, e := range v.AllowedExtensions {
		if e == ext {
			allowed = true
			break
		}
	}

	if !allowed {
		return errors.NewBadRequest("File extension not allowed. Allowed extensions: .jpg, .jpeg, .png, .gif, .webp, .heic")
	}

	return v.ValidateNext(ctx, req)
}

// FileSizeValidator validates that the file size is within limits.
type FileSizeValidator struct {
	BaseValidator
	MinSize int64
	MaxSize int64
}

// NewFileSizeValidator creates a new FileSizeValidator with default limits.
func NewFileSizeValidator() *FileSizeValidator {
	return &FileSizeValidator{
		MinSize: 1,                     // 1 byte minimum
		MaxSize: 50 * 1024 * 1024,      // 50 MB maximum
	}
}

// Validate checks that the file size is within limits.
func (v *FileSizeValidator) Validate(ctx context.Context, req interface{}) error {
	uploadReq, ok := req.(UploadRequest)
	if !ok {
		return v.ValidateNext(ctx, req)
	}

	if uploadReq.Size < v.MinSize {
		return errors.NewBadRequest("File is empty")
	}

	if uploadReq.Size > v.MaxSize {
		return errors.NewBadRequest("File size exceeds maximum limit of 50 MB")
	}

	return v.ValidateNext(ctx, req)
}

// FileNameValidator validates the file name.
type FileNameValidator struct {
	BaseValidator
	MaxLength int
}

// NewFileNameValidator creates a new FileNameValidator.
func NewFileNameValidator() *FileNameValidator {
	return &FileNameValidator{
		MaxLength: 255,
	}
}

// Validate checks that the file name is valid.
func (v *FileNameValidator) Validate(ctx context.Context, req interface{}) error {
	uploadReq, ok := req.(UploadRequest)
	if !ok {
		return v.ValidateNext(ctx, req)
	}

	if uploadReq.FileName == "" {
		return errors.NewBadRequest("File name is required")
	}

	if len(uploadReq.FileName) > v.MaxLength {
		return errors.NewBadRequest("File name is too long")
	}

	// Check for dangerous characters
	dangerous := []string{"..", "/", "\\", "\x00"}
	for _, d := range dangerous {
		if strings.Contains(uploadReq.FileName, d) {
			return errors.NewBadRequest("File name contains invalid characters")
		}
	}

	return v.ValidateNext(ctx, req)
}

// GalleryIDValidator validates that a gallery ID is provided.
type GalleryIDValidator struct {
	BaseValidator
}

// NewGalleryIDValidator creates a new GalleryIDValidator.
func NewGalleryIDValidator() *GalleryIDValidator {
	return &GalleryIDValidator{}
}

// Validate checks that a gallery ID is provided.
func (v *GalleryIDValidator) Validate(ctx context.Context, req interface{}) error {
	uploadReq, ok := req.(UploadRequest)
	if !ok {
		return v.ValidateNext(ctx, req)
	}

	if uploadReq.GalleryID == "" {
		return errors.NewBadRequest("Gallery ID is required")
	}

	return v.ValidateNext(ctx, req)
}

// NewUploadValidationChain creates a complete validation chain for photo uploads.
func NewUploadValidationChain() Validator {
	galleryID := NewGalleryIDValidator()
	fileName := NewFileNameValidator()
	fileType := NewFileTypeValidator()
	fileExt := NewFileExtensionValidator()
	fileSize := NewFileSizeValidator()

	// Build the chain
	galleryID.SetNext(fileName).SetNext(fileType).SetNext(fileExt).SetNext(fileSize)

	return galleryID
}

// ValidateUploadRequest validates a photo upload request.
func ValidateUploadRequest(ctx context.Context, req UploadRequest) error {
	chain := NewUploadValidationChain()
	return chain.Validate(ctx, req)
}
