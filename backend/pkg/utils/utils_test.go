package utils

import (
	"strings"
	"testing"
)

func TestGenerateID(t *testing.T) {
	tests := []struct {
		name   string
		prefix string
	}{
		{"photo prefix", "photo"},
		{"gallery prefix", "gal"},
		{"session prefix", "session"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id := GenerateID(tt.prefix)

			// Check prefix
			if !strings.HasPrefix(id, tt.prefix+"_") {
				t.Errorf("GenerateID() prefix = %v, want %v_", id, tt.prefix)
			}

			// Check uniqueness - generate multiple IDs
			ids := make(map[string]bool)
			for i := 0; i < 100; i++ {
				id := GenerateID(tt.prefix)
				if ids[id] {
					t.Errorf("GenerateID() generated duplicate ID: %s", id)
				}
				ids[id] = true
			}
		})
	}
}

func TestGenerateCustomURL(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantBase string
	}{
		{"simple name", "My Gallery", "my-gallery"},
		{"with spaces", "John And Jane Wedding", "john-and-jane-wedding"},
		{"with special chars", "My Gallery! 2024", "my-gallery-2024"},
		{"multiple spaces", "Test   Multiple   Spaces", "test-multiple-spaces"},
		{"leading/trailing spaces", "  Test  ", "test"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := GenerateCustomURL(tt.input)

			// Check that it starts with the expected base
			if !strings.HasPrefix(url, tt.wantBase) {
				t.Errorf("GenerateCustomURL() = %v, want prefix %v", url, tt.wantBase)
			}

			// Check that it has a random suffix (separated by hyphen)
			parts := strings.Split(url, "-")
			if len(parts) < 2 {
				t.Errorf("GenerateCustomURL() should have random suffix, got %v", url)
			}

			// Verify URL is valid (lowercase alphanumeric with hyphens)
			if !ValidateCustomURL(url) {
				t.Errorf("GenerateCustomURL() generated invalid URL: %v", url)
			}
		})
	}
}

func TestValidateCustomURL(t *testing.T) {
	tests := []struct {
		name  string
		url   string
		valid bool
	}{
		{"valid simple", "my-gallery", true},
		{"valid with numbers", "gallery-123", true},
		{"valid complex", "john-jane-wedding-2024", true},
		{"too short", "ab", false},
		{"too long", strings.Repeat("a", 101), false},
		{"uppercase", "My-Gallery", false},
		{"special chars", "my_gallery", false},
		{"spaces", "my gallery", false},
		{"empty", "", false},
		{"just hyphens", "---", true}, // Valid pattern but poor practice
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ValidateCustomURL(tt.url); got != tt.valid {
				t.Errorf("ValidateCustomURL(%v) = %v, want %v", tt.url, got, tt.valid)
			}
		})
	}
}

func TestHashIPAddress(t *testing.T) {
	tests := []struct {
		name string
		ip   string
	}{
		{"IPv4", "192.168.1.1"},
		{"IPv6", "2001:0db8:85a3:0000:0000:8a2e:0370:7334"},
		{"localhost", "127.0.0.1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hash := HashIPAddress(tt.ip)

			// Check that hash is not empty
			if hash == "" {
				t.Error("HashIPAddress() returned empty string")
			}

			// Check consistency - same input should give same hash
			hash2 := HashIPAddress(tt.ip)
			if hash != hash2 {
				t.Errorf("HashIPAddress() not consistent: %v != %v", hash, hash2)
			}

			// Check that hash is different from input (privacy)
			if hash == tt.ip {
				t.Error("HashIPAddress() returned unhashed IP")
			}
		})
	}
}

func BenchmarkGenerateID(b *testing.B) {
	for i := 0; i < b.N; i++ {
		GenerateID("photo")
	}
}

func BenchmarkGenerateCustomURL(b *testing.B) {
	for i := 0; i < b.N; i++ {
		GenerateCustomURL("My Test Gallery")
	}
}

func BenchmarkValidateCustomURL(b *testing.B) {
	url := "my-test-gallery-abc123"
	for i := 0; i < b.N; i++ {
		ValidateCustomURL(url)
	}
}
