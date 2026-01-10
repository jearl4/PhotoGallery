package s3key

import (
	"testing"
)

func TestParse(t *testing.T) {
	tests := []struct {
		name      string
		objectKey string
		want      *Key
		wantErr   bool
	}{
		{
			name:      "valid key",
			objectKey: "gal_123/photo_456/image.jpg",
			want: &Key{
				GalleryID: "gal_123",
				PhotoID:   "photo_456",
				FileName:  "image.jpg",
				Extension: ".jpg",
			},
			wantErr: false,
		},
		{
			name:      "valid key with png",
			objectKey: "gal_abc123/photo_xyz789/photo.png",
			want: &Key{
				GalleryID: "gal_abc123",
				PhotoID:   "photo_xyz789",
				FileName:  "photo.png",
				Extension: ".png",
			},
			wantErr: false,
		},
		{
			name:      "too few parts",
			objectKey: "gal_123/photo_456",
			want:      nil,
			wantErr:   true,
		},
		{
			name:      "invalid gallery ID prefix",
			objectKey: "gallery_123/photo_456/image.jpg",
			want:      nil,
			wantErr:   true,
		},
		{
			name:      "invalid photo ID prefix",
			objectKey: "gal_123/img_456/image.jpg",
			want:      nil,
			wantErr:   true,
		},
		{
			name:      "single part",
			objectKey: "image.jpg",
			want:      nil,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Parse(tt.objectKey)
			if (err != nil) != tt.wantErr {
				t.Errorf("Parse() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr {
				return
			}
			if got.GalleryID != tt.want.GalleryID {
				t.Errorf("Parse() GalleryID = %v, want %v", got.GalleryID, tt.want.GalleryID)
			}
			if got.PhotoID != tt.want.PhotoID {
				t.Errorf("Parse() PhotoID = %v, want %v", got.PhotoID, tt.want.PhotoID)
			}
			if got.FileName != tt.want.FileName {
				t.Errorf("Parse() FileName = %v, want %v", got.FileName, tt.want.FileName)
			}
			if got.Extension != tt.want.Extension {
				t.Errorf("Parse() Extension = %v, want %v", got.Extension, tt.want.Extension)
			}
		})
	}
}

func TestExtractGalleryID(t *testing.T) {
	tests := []struct {
		name      string
		objectKey string
		want      string
		wantErr   bool
	}{
		{
			name:      "valid key",
			objectKey: "gal_123/photo_456/image.jpg",
			want:      "gal_123",
			wantErr:   false,
		},
		{
			name:      "invalid key",
			objectKey: "invalid",
			want:      "",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ExtractGalleryID(tt.objectKey)
			if (err != nil) != tt.wantErr {
				t.Errorf("ExtractGalleryID() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("ExtractGalleryID() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExtractPhotoID(t *testing.T) {
	tests := []struct {
		name      string
		objectKey string
		want      string
		wantErr   bool
	}{
		{
			name:      "valid key",
			objectKey: "gal_123/photo_456/image.jpg",
			want:      "photo_456",
			wantErr:   false,
		},
		{
			name:      "invalid key",
			objectKey: "invalid",
			want:      "",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ExtractPhotoID(tt.objectKey)
			if (err != nil) != tt.wantErr {
				t.Errorf("ExtractPhotoID() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("ExtractPhotoID() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBuild(t *testing.T) {
	got := Build("gal_123", "photo_456", "image.jpg")
	want := "gal_123/photo_456/image.jpg"
	if got != want {
		t.Errorf("Build() = %v, want %v", got, want)
	}
}

func TestBuildWithVariant(t *testing.T) {
	got := BuildWithVariant("gal_123", "photo_456", "thumbnail", "image.jpg")
	want := "gal_123/photo_456/thumbnail/image.jpg"
	if got != want {
		t.Errorf("BuildWithVariant() = %v, want %v", got, want)
	}
}

func TestChangeExtension(t *testing.T) {
	tests := []struct {
		name   string
		key    string
		newExt string
		want   string
	}{
		{
			name:   "change jpg to png",
			key:    "path/to/image.jpg",
			newExt: ".png",
			want:   "path/to/image.png",
		},
		{
			name:   "no extension",
			key:    "path/to/image",
			newExt: ".jpg",
			want:   "path/to/image.jpg",
		},
		{
			name:   "multiple dots",
			key:    "path/to/file.name.jpg",
			newExt: ".png",
			want:   "path/to/file.name.png",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ChangeExtension(tt.key, tt.newExt)
			if got != tt.want {
				t.Errorf("ChangeExtension() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsValidGalleryID(t *testing.T) {
	tests := []struct {
		id   string
		want bool
	}{
		{"gal_123", true},
		{"gal_abc", true},
		{"gal_", false},
		{"gallery_123", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.id, func(t *testing.T) {
			got := IsValidGalleryID(tt.id)
			if got != tt.want {
				t.Errorf("IsValidGalleryID(%q) = %v, want %v", tt.id, got, tt.want)
			}
		})
	}
}

func TestIsValidPhotoID(t *testing.T) {
	tests := []struct {
		id   string
		want bool
	}{
		{"photo_123", true},
		{"photo_abc", true},
		{"photo_", false},
		{"image_123", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.id, func(t *testing.T) {
			got := IsValidPhotoID(tt.id)
			if got != tt.want {
				t.Errorf("IsValidPhotoID(%q) = %v, want %v", tt.id, got, tt.want)
			}
		})
	}
}

func TestIsImageExtension(t *testing.T) {
	tests := []struct {
		ext  string
		want bool
	}{
		{".jpg", true},
		{".JPG", true},
		{".jpeg", true},
		{".png", true},
		{".gif", true},
		{".webp", true},
		{".heic", true},
		{".pdf", false},
		{".txt", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.ext, func(t *testing.T) {
			got := IsImageExtension(tt.ext)
			if got != tt.want {
				t.Errorf("IsImageExtension(%q) = %v, want %v", tt.ext, got, tt.want)
			}
		})
	}
}

func TestGetMimeType(t *testing.T) {
	tests := []struct {
		ext  string
		want string
	}{
		{".jpg", "image/jpeg"},
		{".jpeg", "image/jpeg"},
		{".png", "image/png"},
		{".gif", "image/gif"},
		{".webp", "image/webp"},
		{".unknown", "application/octet-stream"},
	}

	for _, tt := range tests {
		t.Run(tt.ext, func(t *testing.T) {
			got := GetMimeType(tt.ext)
			if got != tt.want {
				t.Errorf("GetMimeType(%q) = %v, want %v", tt.ext, got, tt.want)
			}
		})
	}
}
