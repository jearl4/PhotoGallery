package image

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"io"

	"github.com/disintegration/imaging"
	"github.com/rwcarlsen/goexif/exif"
	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
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
	Width        int
	Height       int
	CameraModel  string
	DateTaken    string
	ISO          int
	Aperture     string
	ShutterSpeed string
	FocalLength  string
	GPS          *GPSData
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

// WatermarkOptions configures watermark application
type WatermarkOptions struct {
	Text     string
	Position string // "bottom-right", "bottom-left", "center"
}

// ApplyWatermark adds a text watermark to an image
func (p *Processor) ApplyWatermark(img image.Image, opts WatermarkOptions) image.Image {
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// Calculate text position based on watermark position
	// Note: x,y represent the TOP-LEFT corner of the background box
	var x, y int
	textWidth := len(opts.Text) * 7 // Approximate width (basic font is ~7px per char)
	textHeight := 13                // Basic font height (including ascent and descent)
	padding := 5                    // Padding around text in background box

	// Total height of background box (text + padding on both sides)
	boxHeight := textHeight + padding*2

	switch opts.Position {
	case "bottom-left":
		x = 0
		y = height - boxHeight
	case "center":
		x = (width - textWidth) / 2
		y = (height - textHeight) / 2
	case "bottom-right":
		fallthrough
	default:
		x = width - textWidth - padding*2
		y = height - boxHeight
	}

	// Draw the watermark text with a semi-transparent background for readability
	return p.drawText(img, opts.Text, x, y)
}

// drawText draws text on an image with a semi-transparent background
// x, y represent the TOP-LEFT corner of the background box
func (p *Processor) drawText(img image.Image, text string, x, y int) image.Image {
	// Convert image to RGBA for drawing
	rgba := image.NewRGBA(img.Bounds())
	for py := 0; py < img.Bounds().Dy(); py++ {
		for px := 0; px < img.Bounds().Dx(); px++ {
			rgba.Set(px, py, img.At(px, py))
		}
	}

	// Font metrics for basicfont.Face7x13
	textWidth := len(text) * 7
	textHeight := 13
	padding := 5

	// Draw semi-transparent background rectangle
	// Background starts at (x-padding, y-padding) and extends to text dimensions
	for py := y - padding; py < y+textHeight+padding; py++ {
		for px := x - padding; px < x+textWidth+padding; px++ {
			if px >= 0 && px < rgba.Bounds().Dx() && py >= 0 && py < rgba.Bounds().Dy() {
				// Semi-transparent black background
				rgba.Set(px, py, color.RGBA{0, 0, 0, 128})
			}
		}
	}

	// Draw white text
	// The font drawer's Y coordinate is the baseline, which is about 11 pixels down from the top
	// of a 13-pixel tall character for basicfont.Face7x13
	baseline := y + 11 // 11 is the ascent for Face7x13
	point := fixed.Point26_6{
		X: fixed.Int26_6(x * 64),
		Y: fixed.Int26_6(baseline * 64),
	}

	d := &font.Drawer{
		Dst:  rgba,
		Src:  image.NewUniform(color.White),
		Face: basicfont.Face7x13,
		Dot:  point,
	}
	d.DrawString(text)

	return rgba
}
