// Package s3key provides utilities for parsing and constructing S3 object keys.
package s3key

import (
	"fmt"
	"path"
	"strings"
)

// Key represents a parsed S3 object key for photo storage.
// Expected format: {galleryID}/{photoID}/{filename}
type Key struct {
	GalleryID string
	PhotoID   string
	FileName  string
	Extension string
}

// Parse parses an S3 object key into its components.
// Expected format: {galleryID}/{photoID}/{filename}
func Parse(objectKey string) (*Key, error) {
	parts := strings.Split(objectKey, "/")
	if len(parts) < 3 {
		return nil, fmt.Errorf("invalid object key format: expected galleryID/photoID/filename, got %s", objectKey)
	}

	galleryID := parts[0]
	photoID := parts[1]
	fileName := parts[2]

	// Validate gallery ID format
	if !strings.HasPrefix(galleryID, "gal_") {
		return nil, fmt.Errorf("invalid gallery ID format in key: %s (expected gal_ prefix)", objectKey)
	}

	// Validate photo ID format
	if !strings.HasPrefix(photoID, "photo_") {
		return nil, fmt.Errorf("invalid photo ID format in key: %s (expected photo_ prefix)", objectKey)
	}

	return &Key{
		GalleryID: galleryID,
		PhotoID:   photoID,
		FileName:  fileName,
		Extension: path.Ext(fileName),
	}, nil
}

// ExtractGalleryID extracts just the gallery ID from an S3 object key.
func ExtractGalleryID(objectKey string) (string, error) {
	key, err := Parse(objectKey)
	if err != nil {
		return "", err
	}
	return key.GalleryID, nil
}

// ExtractPhotoID extracts just the photo ID from an S3 object key.
func ExtractPhotoID(objectKey string) (string, error) {
	key, err := Parse(objectKey)
	if err != nil {
		return "", err
	}
	return key.PhotoID, nil
}

// Build constructs an S3 object key from components.
func Build(galleryID, photoID, fileName string) string {
	return fmt.Sprintf("%s/%s/%s", galleryID, photoID, fileName)
}

// BuildWithVariant constructs an S3 object key with a variant prefix (e.g., original, optimized, thumbnail).
func BuildWithVariant(galleryID, photoID, variant, fileName string) string {
	return fmt.Sprintf("%s/%s/%s/%s", galleryID, photoID, variant, fileName)
}

// ChangeExtension changes the file extension of an S3 key.
func ChangeExtension(key, newExt string) string {
	lastDot := strings.LastIndex(key, ".")
	if lastDot == -1 {
		return key + newExt
	}
	return key[:lastDot] + newExt
}

// GetOriginalKey returns the original image key given a processed image key.
func GetOriginalKey(processedKey string) string {
	// Replace optimized/thumbnail bucket path references if any
	key := strings.Replace(processedKey, "/optimized/", "/original/", 1)
	key = strings.Replace(key, "/thumbnail/", "/original/", 1)
	return key
}

// GetOptimizedKey returns the optimized image key from an original key.
func GetOptimizedKey(originalKey string) string {
	return strings.Replace(originalKey, "/original/", "/optimized/", 1)
}

// GetThumbnailKey returns the thumbnail image key from an original key.
func GetThumbnailKey(originalKey string) string {
	return strings.Replace(originalKey, "/original/", "/thumbnail/", 1)
}

// IsValidGalleryID checks if a string is a valid gallery ID format.
func IsValidGalleryID(id string) bool {
	return strings.HasPrefix(id, "gal_") && len(id) > 4
}

// IsValidPhotoID checks if a string is a valid photo ID format.
func IsValidPhotoID(id string) bool {
	return strings.HasPrefix(id, "photo_") && len(id) > 6
}

// GetFileNameWithoutExtension returns the file name without its extension.
func GetFileNameWithoutExtension(fileName string) string {
	ext := path.Ext(fileName)
	return strings.TrimSuffix(fileName, ext)
}

// IsImageExtension checks if the extension is a valid image type.
func IsImageExtension(ext string) bool {
	ext = strings.ToLower(ext)
	validExtensions := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".webp": true,
		".heic": true,
		".heif": true,
	}
	return validExtensions[ext]
}

// GetMimeType returns the MIME type for a file extension.
func GetMimeType(ext string) string {
	ext = strings.ToLower(ext)
	mimeTypes := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
		".heic": "image/heic",
		".heif": "image/heif",
	}
	if mime, ok := mimeTypes[ext]; ok {
		return mime
	}
	return "application/octet-stream"
}
