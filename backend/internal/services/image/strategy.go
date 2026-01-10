// Package image provides image processing strategies following the Strategy pattern.
package image

import (
	"bytes"
	"fmt"
	"image"
	"io"

	"github.com/disintegration/imaging"
)

// ProcessingStrategy defines the interface for image processing strategies.
type ProcessingStrategy interface {
	// Process applies the processing strategy to an image and returns the result.
	Process(img image.Image) (image.Image, error)
	// Name returns the strategy name for logging and identification.
	Name() string
}

// StrategyChain allows chaining multiple strategies together.
type StrategyChain struct {
	strategies []ProcessingStrategy
}

// NewStrategyChain creates a new strategy chain.
func NewStrategyChain(strategies ...ProcessingStrategy) *StrategyChain {
	return &StrategyChain{strategies: strategies}
}

// Add adds a strategy to the chain.
func (sc *StrategyChain) Add(strategy ProcessingStrategy) *StrategyChain {
	sc.strategies = append(sc.strategies, strategy)
	return sc
}

// Process applies all strategies in sequence.
func (sc *StrategyChain) Process(img image.Image) (image.Image, error) {
	result := img
	for _, strategy := range sc.strategies {
		var err error
		result, err = strategy.Process(result)
		if err != nil {
			return nil, fmt.Errorf("strategy %s failed: %w", strategy.Name(), err)
		}
	}
	return result, nil
}

// Name returns the chain name.
func (sc *StrategyChain) Name() string {
	return "chain"
}

// ThumbnailStrategy creates a thumbnail by center-cropping to a fixed size.
type ThumbnailStrategy struct {
	Width  int
	Height int
}

// NewThumbnailStrategy creates a new thumbnail strategy with default dimensions.
func NewThumbnailStrategy() *ThumbnailStrategy {
	return &ThumbnailStrategy{
		Width:  ThumbnailWidth,
		Height: ThumbnailHeight,
	}
}

// Process creates a center-cropped thumbnail.
func (s *ThumbnailStrategy) Process(img image.Image) (image.Image, error) {
	return imaging.Fill(img, s.Width, s.Height, imaging.Center, imaging.Lanczos), nil
}

// Name returns the strategy name.
func (s *ThumbnailStrategy) Name() string {
	return "thumbnail"
}

// ResizeStrategy resizes an image to fit within max dimensions while preserving aspect ratio.
type ResizeStrategy struct {
	MaxWidth  int
	MaxHeight int
}

// NewResizeStrategy creates a new resize strategy with default dimensions.
func NewResizeStrategy() *ResizeStrategy {
	return &ResizeStrategy{
		MaxWidth:  OptimizedMaxWidth,
		MaxHeight: OptimizedMaxHeight,
	}
}

// Process resizes the image if it exceeds max dimensions.
func (s *ResizeStrategy) Process(img image.Image) (image.Image, error) {
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	if width > s.MaxWidth || height > s.MaxHeight {
		return imaging.Fit(img, s.MaxWidth, s.MaxHeight, imaging.Lanczos), nil
	}
	return img, nil
}

// Name returns the strategy name.
func (s *ResizeStrategy) Name() string {
	return "resize"
}

// WatermarkStrategy applies a text watermark to an image.
type WatermarkStrategy struct {
	processor *Processor
	Options   WatermarkOptions
}

// NewWatermarkStrategy creates a new watermark strategy.
func NewWatermarkStrategy(text, position string) *WatermarkStrategy {
	return &WatermarkStrategy{
		processor: NewProcessor(),
		Options: WatermarkOptions{
			Text:     text,
			Position: position,
		},
	}
}

// Process applies a watermark to the image.
func (s *WatermarkStrategy) Process(img image.Image) (image.Image, error) {
	if s.Options.Text == "" {
		return img, nil
	}
	return s.processor.ApplyWatermark(img, s.Options), nil
}

// Name returns the strategy name.
func (s *WatermarkStrategy) Name() string {
	return "watermark"
}

// GrayscaleStrategy converts an image to grayscale.
type GrayscaleStrategy struct{}

// NewGrayscaleStrategy creates a new grayscale strategy.
func NewGrayscaleStrategy() *GrayscaleStrategy {
	return &GrayscaleStrategy{}
}

// Process converts the image to grayscale.
func (s *GrayscaleStrategy) Process(img image.Image) (image.Image, error) {
	return imaging.Grayscale(img), nil
}

// Name returns the strategy name.
func (s *GrayscaleStrategy) Name() string {
	return "grayscale"
}

// BlurStrategy applies a blur effect.
type BlurStrategy struct {
	Sigma float64
}

// NewBlurStrategy creates a new blur strategy.
func NewBlurStrategy(sigma float64) *BlurStrategy {
	return &BlurStrategy{Sigma: sigma}
}

// Process applies blur to the image.
func (s *BlurStrategy) Process(img image.Image) (image.Image, error) {
	return imaging.Blur(img, s.Sigma), nil
}

// Name returns the strategy name.
func (s *BlurStrategy) Name() string {
	return "blur"
}

// SharpenStrategy applies a sharpen effect.
type SharpenStrategy struct {
	Sigma float64
}

// NewSharpenStrategy creates a new sharpen strategy.
func NewSharpenStrategy(sigma float64) *SharpenStrategy {
	return &SharpenStrategy{Sigma: sigma}
}

// Process applies sharpening to the image.
func (s *SharpenStrategy) Process(img image.Image) (image.Image, error) {
	return imaging.Sharpen(img, s.Sigma), nil
}

// Name returns the strategy name.
func (s *SharpenStrategy) Name() string {
	return "sharpen"
}

// ImageProcessor uses strategies to process images.
type ImageProcessor struct {
	encoder Encoder
}

// Encoder defines how to encode processed images.
type Encoder interface {
	Encode(img image.Image) ([]byte, error)
	Format() string
}

// JPEGEncoder encodes images as JPEG.
type JPEGEncoder struct {
	Quality int
}

// NewJPEGEncoder creates a new JPEG encoder with the given quality.
func NewJPEGEncoder(quality int) *JPEGEncoder {
	return &JPEGEncoder{Quality: quality}
}

// Encode encodes the image as JPEG.
func (e *JPEGEncoder) Encode(img image.Image) ([]byte, error) {
	var buf bytes.Buffer
	if err := imaging.Encode(&buf, img, imaging.JPEG, imaging.JPEGQuality(e.Quality)); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// Format returns the output format.
func (e *JPEGEncoder) Format() string {
	return "jpeg"
}

// PNGEncoder encodes images as PNG.
type PNGEncoder struct{}

// NewPNGEncoder creates a new PNG encoder.
func NewPNGEncoder() *PNGEncoder {
	return &PNGEncoder{}
}

// Encode encodes the image as PNG.
func (e *PNGEncoder) Encode(img image.Image) ([]byte, error) {
	var buf bytes.Buffer
	if err := imaging.Encode(&buf, img, imaging.PNG); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// Format returns the output format.
func (e *PNGEncoder) Format() string {
	return "png"
}

// NewImageProcessor creates a new image processor with the given encoder.
func NewImageProcessor(encoder Encoder) *ImageProcessor {
	return &ImageProcessor{encoder: encoder}
}

// Process decodes an image, applies the strategy, and encodes the result.
func (p *ImageProcessor) Process(imageData io.Reader, strategy ProcessingStrategy) ([]byte, error) {
	img, _, err := image.Decode(imageData)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	processed, err := strategy.Process(img)
	if err != nil {
		return nil, fmt.Errorf("processing failed: %w", err)
	}

	return p.encoder.Encode(processed)
}

// ProcessWithChain processes an image through multiple strategies.
func (p *ImageProcessor) ProcessWithChain(imageData io.Reader, strategies ...ProcessingStrategy) ([]byte, error) {
	chain := NewStrategyChain(strategies...)
	return p.Process(imageData, chain)
}
