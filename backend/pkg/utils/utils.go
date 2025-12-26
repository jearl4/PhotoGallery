package utils

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// GenerateID generates a unique ID using timestamp + random bytes
func GenerateID(prefix string) string {
	timestamp := time.Now().Unix()
	randomBytes := make([]byte, 10)
	rand.Read(randomBytes)
	encoded := base32.StdEncoding.EncodeToString(randomBytes)
	encoded = strings.TrimRight(encoded, "=")
	return fmt.Sprintf("%s_%d_%s", prefix, timestamp, strings.ToLower(encoded))
}

// GenerateCustomURL creates a URL-safe slug from a string
func GenerateCustomURL(name string) string {
	// Convert to lowercase
	slug := strings.ToLower(name)

	// Replace spaces and special chars with hyphens
	reg := regexp.MustCompile("[^a-z0-9]+")
	slug = reg.ReplaceAllString(slug, "-")

	// Remove leading/trailing hyphens
	slug = strings.Trim(slug, "-")

	// Add random suffix to ensure uniqueness
	randomBytes := make([]byte, 4)
	rand.Read(randomBytes)
	suffix := base32.StdEncoding.EncodeToString(randomBytes)
	suffix = strings.TrimRight(suffix, "=")

	return fmt.Sprintf("%s-%s", slug, strings.ToLower(suffix))
}

// ValidateCustomURL checks if a custom URL is valid
func ValidateCustomURL(url string) bool {
	if len(url) < 3 || len(url) > 100 {
		return false
	}
	matched, _ := regexp.MatchString("^[a-z0-9-]+$", url)
	return matched
}

// HashIPAddress creates a hash of an IP address for privacy
func HashIPAddress(ip string) string {
	// Simple hash for demo - use proper hashing in production
	return fmt.Sprintf("hash_%s", ip)
}
