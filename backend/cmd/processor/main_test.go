package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	stdimage "image"
	"image/color"
	"image/jpeg"
	"io"
	"testing"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	appconfig "photographer-gallery/backend/internal/config"
	"photographer-gallery/backend/internal/repository"
	"photographer-gallery/backend/internal/services/image"
	"photographer-gallery/backend/pkg/utils/s3key"
)

// Mock S3 Client
type mockS3Client struct {
	getObjectFunc func(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error)
	putObjectFunc func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error)
}

func (m *mockS3Client) GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
	if m.getObjectFunc != nil {
		return m.getObjectFunc(ctx, params, optFns...)
	}
	return nil, fmt.Errorf("GetObject not mocked")
}

func (m *mockS3Client) PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
	if m.putObjectFunc != nil {
		return m.putObjectFunc(ctx, params, optFns...)
	}
	return nil, fmt.Errorf("PutObject not mocked")
}

// Mock Photo Repository
type mockPhotoRepository struct {
	getByIDFunc func(ctx context.Context, id string) (*repository.Photo, error)
	updateFunc  func(ctx context.Context, photo *repository.Photo) error
	createFunc  func(ctx context.Context, photo *repository.Photo) error
}

func (m *mockPhotoRepository) GetByID(ctx context.Context, id string) (*repository.Photo, error) {
	if m.getByIDFunc != nil {
		return m.getByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockPhotoRepository) Update(ctx context.Context, photo *repository.Photo) error {
	if m.updateFunc != nil {
		return m.updateFunc(ctx, photo)
	}
	return nil
}

func (m *mockPhotoRepository) Create(ctx context.Context, photo *repository.Photo) error {
	if m.createFunc != nil {
		return m.createFunc(ctx, photo)
	}
	return nil
}

func (m *mockPhotoRepository) Delete(ctx context.Context, id string) error { return nil }
func (m *mockPhotoRepository) ListByGallery(ctx context.Context, galleryID string, limit int, lastEvaluatedKey map[string]interface{}) ([]*repository.Photo, map[string]interface{}, error) {
	return nil, nil, nil
}
func (m *mockPhotoRepository) IncrementFavoriteCount(ctx context.Context, photoID string, delta int) error {
	return nil
}
func (m *mockPhotoRepository) IncrementDownloadCount(ctx context.Context, photoID string) error {
	return nil
}

// Mock Gallery Repository
type mockGalleryRepository struct{}

func (m *mockGalleryRepository) Create(ctx context.Context, g *repository.Gallery) error { return nil }
func (m *mockGalleryRepository) GetByID(ctx context.Context, id string) (*repository.Gallery, error) {
	return &repository.Gallery{GalleryID: id}, nil
}
func (m *mockGalleryRepository) GetByCustomURL(ctx context.Context, url string) (*repository.Gallery, error) {
	return nil, nil
}
func (m *mockGalleryRepository) Update(ctx context.Context, g *repository.Gallery) error { return nil }
func (m *mockGalleryRepository) Delete(ctx context.Context, id string) error             { return nil }
func (m *mockGalleryRepository) ListByPhotographer(ctx context.Context, pID string, limit int, lastKey map[string]interface{}) ([]*repository.Gallery, map[string]interface{}, error) {
	return nil, nil, nil
}
func (m *mockGalleryRepository) UpdatePhotoCount(ctx context.Context, id string, delta int) error {
	return nil
}
func (m *mockGalleryRepository) UpdateTotalSize(ctx context.Context, id string, delta int64) error {
	return nil
}
func (m *mockGalleryRepository) ListExpired(ctx context.Context, limit int) ([]*repository.Gallery, error) {
	return nil, nil
}
func (m *mockGalleryRepository) IncrementClientAccessCount(ctx context.Context, id string) error {
	return nil
}

func createTestImage(width, height int) stdimage.Image {
	img := stdimage.NewRGBA(stdimage.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255})
		}
	}
	return img
}

// Tests for s3key package functions (moved from main)
func TestS3KeyParse(t *testing.T) {
	tests := []struct {
		name      string
		objectKey string
		wantID    string
		wantErr   bool
	}{
		{
			name:      "valid key",
			objectKey: "galleries/gallery-abc/photos/photo-123/original.jpg",
			wantID:    "photo-123",
			wantErr:   false,
		},
		{
			name:      "invalid key - missing parts",
			objectKey: "galleries/gallery-123/images/photo-456/original.jpg",
			wantID:    "",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed, err := s3key.Parse(tt.objectKey)
			if (err != nil) != tt.wantErr {
				t.Errorf("s3key.Parse() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if parsed != nil && parsed.PhotoID != tt.wantID {
				t.Errorf("s3key.Parse().PhotoID = %v, want %v", parsed.PhotoID, tt.wantID)
			}
		})
	}
}

func TestS3KeyChangeExtension(t *testing.T) {
	tests := []struct {
		key, newExt, want string
	}{
		{"photo.jpg", ".webp", "photo.webp"},
		{"galleries/123/photos/456/original.jpg", ".webp", "galleries/123/photos/456/original.webp"},
	}

	for _, tt := range tests {
		got := s3key.ChangeExtension(tt.key, tt.newExt)
		if got != tt.want {
			t.Errorf("s3key.ChangeExtension(%q, %q) = %q, want %q", tt.key, tt.newExt, got, tt.want)
		}
	}
}

func TestUploadToS3(t *testing.T) {
	tests := []struct {
		name      string
		bucket    string
		key       string
		data      []byte
		mockError error
		wantErr   bool
	}{
		{"successful upload", "test-bucket", "test-key", []byte("data"), nil, false},
		{"upload error", "test-bucket", "test-key", []byte("data"), fmt.Errorf("S3 error"), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockS3 := &mockS3Client{
				putObjectFunc: func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
					return &s3.PutObjectOutput{}, tt.mockError
				},
			}

			app := &App{
				cfg:      &appconfig.ProcessorConfig{S3BucketOriginal: "test"},
				s3Client: mockS3,
			}

			err := app.uploadToS3(context.Background(), tt.bucket, tt.key, tt.data, "image/jpeg")
			if (err != nil) != tt.wantErr {
				t.Errorf("uploadToS3() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestProcessPhoto(t *testing.T) {
	testImg := createTestImage(1920, 1080)
	var imgBuf bytes.Buffer
	jpeg.Encode(&imgBuf, testImg, nil)
	testImageData := imgBuf.Bytes()

	tests := []struct {
		name      string
		objectKey string
		wantErr   bool
	}{
		{
			name:      "successful processing",
			objectKey: "galleries/gallery-abc/photos/photo-123/original.jpg",
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockS3 := &mockS3Client{
				getObjectFunc: func(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
					return &s3.GetObjectOutput{Body: io.NopCloser(bytes.NewReader(testImageData))}, nil
				},
				putObjectFunc: func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
					return &s3.PutObjectOutput{}, nil
				},
			}

			mockPhoto := &mockPhotoRepository{
				getByIDFunc: func(ctx context.Context, id string) (*repository.Photo, error) {
					return &repository.Photo{PhotoID: id, Metadata: make(map[string]string)}, nil
				},
				updateFunc: func(ctx context.Context, photo *repository.Photo) error { return nil },
			}

			app := &App{
				cfg: &appconfig.ProcessorConfig{
					S3BucketOriginal:  "test-original",
					S3BucketOptimized: "test-optimized",
					S3BucketThumbnail: "test-thumbnail",
				},
				s3Client:    mockS3,
				photoRepo:   mockPhoto,
				galleryRepo: &mockGalleryRepository{},
				processor:   image.NewProcessor(),
			}

			parsed, _ := s3key.Parse(tt.objectKey)
			err := app.processPhoto(context.Background(), parsed, "test-bucket", tt.objectKey)
			if (err != nil) != tt.wantErr {
				t.Errorf("processPhoto() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestHandleS3Event(t *testing.T) {
	testImg := createTestImage(800, 600)
	var imgBuf bytes.Buffer
	jpeg.Encode(&imgBuf, testImg, nil)
	testImageData := imgBuf.Bytes()

	mockS3 := &mockS3Client{
		getObjectFunc: func(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
			return &s3.GetObjectOutput{Body: io.NopCloser(bytes.NewReader(testImageData))}, nil
		},
		putObjectFunc: func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
			return &s3.PutObjectOutput{}, nil
		},
	}

	mockPhoto := &mockPhotoRepository{
		getByIDFunc: func(ctx context.Context, id string) (*repository.Photo, error) {
			return &repository.Photo{PhotoID: id, Metadata: make(map[string]string)}, nil
		},
		updateFunc: func(ctx context.Context, photo *repository.Photo) error { return nil },
	}

	app := &App{
		cfg: &appconfig.ProcessorConfig{
			S3BucketOriginal:  "test-original",
			S3BucketOptimized: "test-optimized",
			S3BucketThumbnail: "test-thumbnail",
		},
		s3Client:    mockS3,
		photoRepo:   mockPhoto,
		galleryRepo: &mockGalleryRepository{},
		processor:   image.NewProcessor(),
	}

	// Create S3 event wrapped in SQS event
	s3Event := events.S3Event{
		Records: []events.S3EventRecord{
			{
				S3: events.S3Entity{
					Bucket: events.S3Bucket{Name: "test-bucket"},
					Object: events.S3Object{Key: "galleries/gallery-123/photos/photo-456/original.jpg"},
				},
			},
		},
	}
	s3EventJSON, _ := json.Marshal(s3Event)

	sqsEvent := events.SQSEvent{
		Records: []events.SQSMessage{
			{Body: string(s3EventJSON)},
		},
	}

	err := app.handleS3Event(context.Background(), sqsEvent)
	if err != nil {
		t.Errorf("handleS3Event() error = %v", err)
	}
}

func TestUpdatePhotoStatus(t *testing.T) {
	mockPhoto := &mockPhotoRepository{
		getByIDFunc: func(ctx context.Context, id string) (*repository.Photo, error) {
			return &repository.Photo{PhotoID: id, ProcessingStatus: "pending"}, nil
		},
		updateFunc: func(ctx context.Context, photo *repository.Photo) error {
			if photo.ProcessingStatus != "completed" {
				return fmt.Errorf("expected status completed, got %s", photo.ProcessingStatus)
			}
			return nil
		},
	}

	app := &App{
		cfg:       &appconfig.ProcessorConfig{},
		photoRepo: mockPhoto,
	}

	// updatePhotoStatus doesn't return an error, it handles errors internally
	app.updatePhotoStatus(context.Background(), "photo-123", "completed")
	// Test passes if no panic
}
