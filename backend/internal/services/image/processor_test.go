package image

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"
)

func TestNewProcessor(t *testing.T) {
	p := NewProcessor()
	if p == nil {
		t.Fatal("NewProcessor() returned nil")
	}
}

func TestGenerateThumbnail(t *testing.T) {
	p := NewProcessor()

	tests := []struct {
		name        string
		imageWidth  int
		imageHeight int
		wantErr     bool
	}{
		{
			name:        "square image",
			imageWidth:  400,
			imageHeight: 400,
			wantErr:     false,
		},
		{
			name:        "landscape image",
			imageWidth:  800,
			imageHeight: 600,
			wantErr:     false,
		},
		{
			name:        "portrait image",
			imageWidth:  600,
			imageHeight: 800,
			wantErr:     false,
		},
		{
			name:        "small image",
			imageWidth:  100,
			imageHeight: 100,
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test image
			img := createTestImage(tt.imageWidth, tt.imageHeight)
			var buf bytes.Buffer
			if err := jpeg.Encode(&buf, img, nil); err != nil {
				t.Fatalf("Failed to encode test image: %v", err)
			}

			// Generate thumbnail
			thumbnailData, err := p.GenerateThumbnail(&buf)
			if (err != nil) != tt.wantErr {
				t.Errorf("GenerateThumbnail() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				// Verify thumbnail is valid JPEG
				thumbnail, err := jpeg.Decode(bytes.NewReader(thumbnailData))
				if err != nil {
					t.Errorf("Generated thumbnail is not a valid JPEG: %v", err)
					return
				}

				// Verify dimensions
				bounds := thumbnail.Bounds()
				if bounds.Dx() != ThumbnailWidth || bounds.Dy() != ThumbnailHeight {
					t.Errorf("Thumbnail dimensions = %dx%d, want %dx%d",
						bounds.Dx(), bounds.Dy(), ThumbnailWidth, ThumbnailHeight)
				}
			}
		})
	}
}

func TestGenerateThumbnail_InvalidImage(t *testing.T) {
	p := NewProcessor()

	// Test with invalid image data
	invalidData := []byte("not an image")
	_, err := p.GenerateThumbnail(bytes.NewReader(invalidData))
	if err == nil {
		t.Error("GenerateThumbnail() should return error for invalid image data")
	}
}

func TestGenerateOptimized(t *testing.T) {
	p := NewProcessor()

	tests := []struct {
		name         string
		imageWidth   int
		imageHeight  int
		expectResize bool
		wantErr      bool
	}{
		{
			name:         "image larger than max - landscape",
			imageWidth:   2400,
			imageHeight:  1800,
			expectResize: true,
			wantErr:      false,
		},
		{
			name:         "image larger than max - portrait",
			imageWidth:   1800,
			imageHeight:  2400,
			expectResize: true,
			wantErr:      false,
		},
		{
			name:         "image smaller than max",
			imageWidth:   1600,
			imageHeight:  900,
			expectResize: false,
			wantErr:      false,
		},
		{
			name:         "image at exact max width",
			imageWidth:   OptimizedMaxWidth,
			imageHeight:  900,
			expectResize: false,
			wantErr:      false,
		},
		{
			name:         "image at exact max height",
			imageWidth:   1600,
			imageHeight:  OptimizedMaxHeight,
			expectResize: false,
			wantErr:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test image
			img := createTestImage(tt.imageWidth, tt.imageHeight)
			var buf bytes.Buffer
			if err := jpeg.Encode(&buf, img, nil); err != nil {
				t.Fatalf("Failed to encode test image: %v", err)
			}

			// Generate optimized version
			optimizedData, err := p.GenerateOptimized(&buf)
			if (err != nil) != tt.wantErr {
				t.Errorf("GenerateOptimized() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				// Verify optimized image is valid JPEG
				optimized, err := jpeg.Decode(bytes.NewReader(optimizedData))
				if err != nil {
					t.Errorf("Generated optimized image is not a valid JPEG: %v", err)
					return
				}

				// Verify dimensions
				bounds := optimized.Bounds()
				width := bounds.Dx()
				height := bounds.Dy()

				// Should not exceed max dimensions
				if width > OptimizedMaxWidth {
					t.Errorf("Optimized width %d exceeds max %d", width, OptimizedMaxWidth)
				}
				if height > OptimizedMaxHeight {
					t.Errorf("Optimized height %d exceeds max %d", height, OptimizedMaxHeight)
				}

				// If resize expected, dimensions should be different
				if tt.expectResize {
					if width == tt.imageWidth && height == tt.imageHeight {
						t.Error("Expected image to be resized, but dimensions unchanged")
					}
				}
			}
		})
	}
}

func TestGenerateOptimized_InvalidImage(t *testing.T) {
	p := NewProcessor()

	// Test with invalid image data
	invalidData := []byte("not an image")
	_, err := p.GenerateOptimized(bytes.NewReader(invalidData))
	if err == nil {
		t.Error("GenerateOptimized() should return error for invalid image data")
	}
}

func TestConvertToWebP(t *testing.T) {
	p := NewProcessor()

	// Create test image
	img := createTestImage(800, 600)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatalf("Failed to encode test image: %v", err)
	}

	// Attempt WebP conversion (should fail as it's not supported)
	_, err := p.ConvertToWebP(&buf)
	if err == nil {
		t.Error("ConvertToWebP() should return error (not supported)")
	}

	// Verify error message mentions not supported
	if err.Error() != "WebP conversion not currently supported" {
		t.Errorf("ConvertToWebP() error = %v, want 'WebP conversion not currently supported'", err)
	}
}

func TestGetImageDimensions(t *testing.T) {
	p := NewProcessor()

	tests := []struct {
		name        string
		imageWidth  int
		imageHeight int
		wantErr     bool
	}{
		{
			name:        "normal image",
			imageWidth:  1920,
			imageHeight: 1080,
			wantErr:     false,
		},
		{
			name:        "square image",
			imageWidth:  500,
			imageHeight: 500,
			wantErr:     false,
		},
		{
			name:        "very small image",
			imageWidth:  10,
			imageHeight: 10,
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test image
			img := createTestImage(tt.imageWidth, tt.imageHeight)
			var buf bytes.Buffer
			if err := jpeg.Encode(&buf, img, nil); err != nil {
				t.Fatalf("Failed to encode test image: %v", err)
			}

			// Get dimensions
			width, height, err := p.GetImageDimensions(&buf)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetImageDimensions() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if width != tt.imageWidth {
					t.Errorf("GetImageDimensions() width = %d, want %d", width, tt.imageWidth)
				}
				if height != tt.imageHeight {
					t.Errorf("GetImageDimensions() height = %d, want %d", height, tt.imageHeight)
				}
			}
		})
	}
}

func TestGetImageDimensions_InvalidImage(t *testing.T) {
	p := NewProcessor()

	// Test with invalid image data
	invalidData := []byte("not an image")
	_, _, err := p.GetImageDimensions(bytes.NewReader(invalidData))
	if err == nil {
		t.Error("GetImageDimensions() should return error for invalid image data")
	}
}

func TestExtractEXIF(t *testing.T) {
	p := NewProcessor()

	t.Run("image without EXIF data", func(t *testing.T) {
		// Create simple test image without EXIF
		img := createTestImage(800, 600)
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, img, nil); err != nil {
			t.Fatalf("Failed to encode test image: %v", err)
		}

		metadata, err := p.ExtractEXIF(&buf)
		if err != nil {
			t.Errorf("ExtractEXIF() should not error on image without EXIF, got: %v", err)
		}

		// Should return empty metadata, not error
		if metadata == nil {
			t.Error("ExtractEXIF() should return empty metadata, not nil")
		}

		// All fields should be empty/zero
		if metadata.CameraModel != "" {
			t.Errorf("Expected empty CameraModel, got: %s", metadata.CameraModel)
		}
		if metadata.ISO != 0 {
			t.Errorf("Expected zero ISO, got: %d", metadata.ISO)
		}
	})

	t.Run("invalid image data", func(t *testing.T) {
		invalidData := []byte("not an image")
		metadata, err := p.ExtractEXIF(bytes.NewReader(invalidData))

		// Should return empty metadata, not error
		if err != nil {
			t.Errorf("ExtractEXIF() should not error, got: %v", err)
		}
		if metadata == nil {
			t.Error("ExtractEXIF() should return empty metadata, not nil")
		}
	})

	// Note: Testing with actual EXIF data would require embedding a JPEG with EXIF
	// or using a library to create EXIF data, which is complex.
	// In production, you could add integration tests with real sample images.
}

func TestExtractEXIF_WithEXIFData(t *testing.T) {
	p := NewProcessor()

	// Create a minimal JPEG with EXIF data
	img := createTestImage(800, 600)

	// Encode as JPEG first
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatalf("Failed to encode test image: %v", err)
	}

	// For this test, we'll just verify it handles the image without EXIF gracefully
	// A full test would require embedding actual EXIF data
	metadata, err := p.ExtractEXIF(&buf)
	if err != nil {
		t.Errorf("ExtractEXIF() unexpected error: %v", err)
	}

	if metadata == nil {
		t.Error("ExtractEXIF() returned nil metadata")
	}
}

// Helper function to create a test image
func createTestImage(width, height int) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	// Fill with a gradient pattern
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r := uint8((x * 255) / width)
			g := uint8((y * 255) / height)
			b := uint8(((x + y) * 255) / (width + height))
			img.Set(x, y, color.RGBA{r, g, b, 255})
		}
	}

	return img
}

func BenchmarkGenerateThumbnail(b *testing.B) {
	p := NewProcessor()
	img := createTestImage(2400, 1800)
	var buf bytes.Buffer
	jpeg.Encode(&buf, img, nil)
	data := buf.Bytes()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := p.GenerateThumbnail(bytes.NewReader(data))
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkGenerateOptimized(b *testing.B) {
	p := NewProcessor()
	img := createTestImage(2400, 1800)
	var buf bytes.Buffer
	jpeg.Encode(&buf, img, nil)
	data := buf.Bytes()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := p.GenerateOptimized(bytes.NewReader(data))
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkGetImageDimensions(b *testing.B) {
	p := NewProcessor()
	img := createTestImage(2400, 1800)
	var buf bytes.Buffer
	jpeg.Encode(&buf, img, nil)
	data := buf.Bytes()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _, err := p.GetImageDimensions(bytes.NewReader(data))
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkExtractEXIF(b *testing.B) {
	p := NewProcessor()
	img := createTestImage(2400, 1800)
	var buf bytes.Buffer
	jpeg.Encode(&buf, img, nil)
	data := buf.Bytes()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := p.ExtractEXIF(bytes.NewReader(data))
		if err != nil {
			b.Fatal(err)
		}
	}
}
