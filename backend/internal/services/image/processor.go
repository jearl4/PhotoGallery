package image

import (
	"bytes"
	"fmt"
	"image"
	"io"

	"github.com/disintegration/imaging"
	"github.com/rwcarlsen/goexif/exif"
)

const (
	// Thumbnail dimensions
	ThumbnailWidth  = 200
	ThumbnailHeight = 200

	// Optimized image max dimensions
	OptimizedMaxWidth  = 1920
	OptimizedMaxHeight = 1080
)

type Processor struct{}

func NewProcessor() *Processor {
	return &Processor{}
}

// ImageMetadata holds extracted metadata from an image
type ImageMetadata struct {
	Width       int
	Height      int
	CameraModel string
	DateTaken   string
	ISO         int
	Aperture    string
	ShutterSpeed string
	FocalLength string
	GPS         *GPSData
}

type GPSData struct {
	Latitude  float64
	Longitude float64
}

// GenerateThumbnail creates a 200x200 thumbnail from the image
func (p *Processor) GenerateThumbnail(imageData io.Reader) ([]byte, error) {
	// Decode the image
	img, _, err := image.Decode(imageData)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	// Create thumbnail with smart cropping (center)
	thumbnail := imaging.Fill(img, ThumbnailWidth, ThumbnailHeight, imaging.Center, imaging.Lanczos)

	// Encode to JPEG
	var buf bytes.Buffer
	if err := imaging.Encode(&buf, thumbnail, imaging.JPEG); err != nil {
		return nil, fmt.Errorf("failed to encode thumbnail: %w", err)
	}

	return buf.Bytes(), nil
}

// GenerateOptimized creates an optimized version of the image (max 1920x1080)
func (p *Processor) GenerateOptimized(imageData io.Reader) ([]byte, error) {
	// Decode the image
	img, _, err := image.Decode(imageData)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	// Get original dimensions
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// Only resize if image is larger than max dimensions
	var resized image.Image
	if width > OptimizedMaxWidth || height > OptimizedMaxHeight {
		resized = imaging.Fit(img, OptimizedMaxWidth, OptimizedMaxHeight, imaging.Lanczos)
	} else {
		resized = img
	}

	// Encode to JPEG
	var buf bytes.Buffer
	if err := imaging.Encode(&buf, resized, imaging.JPEG); err != nil {
		return nil, fmt.Errorf("failed to encode optimized image: %w", err)
	}

	return buf.Bytes(), nil
}

// ConvertToWebP converts an image to WebP format
// NOTE: WebP conversion disabled - requires CGO which complicates cross-compilation
// Can be re-enabled later with a pure Go WebP library or by using CGO in Docker build
func (p *Processor) ConvertToWebP(imageData io.Reader) ([]byte, error) {
	return nil, fmt.Errorf("WebP conversion not currently supported")
}

// ExtractEXIF extracts EXIF metadata from an image
func (p *Processor) ExtractEXIF(imageData io.Reader) (*ImageMetadata, error) {
	metadata := &ImageMetadata{}

	// Try to extract EXIF data
	x, err := exif.Decode(imageData)
	if err != nil {
		// If EXIF extraction fails, return empty metadata (not an error)
		return metadata, nil
	}

	// Extract camera model
	if cameraModel, err := x.Get(exif.Model); err == nil {
		if val, err := cameraModel.StringVal(); err == nil {
			metadata.CameraModel = val
		}
	}

	// Extract date taken
	if dateTaken, err := x.Get(exif.DateTimeOriginal); err == nil {
		if val, err := dateTaken.StringVal(); err == nil {
			metadata.DateTaken = val
		}
	}

	// Extract ISO
	if isoTag, err := x.Get(exif.ISOSpeedRatings); err == nil {
		if val, err := isoTag.Int(0); err == nil {
			metadata.ISO = val
		}
	}

	// Extract aperture
	if apertureTag, err := x.Get(exif.FNumber); err == nil {
		if val, err := apertureTag.Rat(0); err == nil {
			apertureFloat, _ := val.Float64()
			metadata.Aperture = fmt.Sprintf("f/%.1f", apertureFloat)
		}
	}

	// Extract shutter speed
	if shutterTag, err := x.Get(exif.ExposureTime); err == nil {
		if val, err := shutterTag.Rat(0); err == nil {
			num := val.Num()
			denom := val.Denom()
			metadata.ShutterSpeed = fmt.Sprintf("%d/%d", num, denom)
		}
	}

	// Extract focal length
	if focalTag, err := x.Get(exif.FocalLength); err == nil {
		if val, err := focalTag.Rat(0); err == nil {
			focalFloat, _ := val.Float64()
			metadata.FocalLength = fmt.Sprintf("%.1fmm", focalFloat)
		}
	}

	// Extract GPS data
	lat, lon, err := x.LatLong()
	if err == nil {
		metadata.GPS = &GPSData{
			Latitude:  lat,
			Longitude: lon,
		}
	}

	return metadata, nil
}

// GetImageDimensions returns the width and height of an image
func (p *Processor) GetImageDimensions(imageData io.Reader) (int, int, error) {
	img, _, err := image.Decode(imageData)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to decode image: %w", err)
	}

	bounds := img.Bounds()
	return bounds.Dx(), bounds.Dy(), nil
}
