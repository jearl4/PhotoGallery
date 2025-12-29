package main

import (
	"bytes"
	"context"
	"fmt"
	stdimage "image"
	"image/color"
	"image/jpeg"
	"io"
	"testing"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"photographer-gallery/backend/internal/repository"
	"photographer-gallery/backend/internal/services/image"
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
}

func (m *mockPhotoRepository) GetByID(ctx context.Context, id string) (*repository.Photo, error) {
	if m.getByIDFunc != nil {
		return m.getByIDFunc(ctx, id)
	}
	return nil, fmt.Errorf("GetByID not mocked")
}

func (m *mockPhotoRepository) Update(ctx context.Context, photo *repository.Photo) error {
	if m.updateFunc != nil {
		return m.updateFunc(ctx, photo)
	}
	return fmt.Errorf("Update not mocked")
}

func (m *mockPhotoRepository) Create(ctx context.Context, photo *repository.Photo) error {
	return fmt.Errorf("Create not implemented in mock")
}

func (m *mockPhotoRepository) Delete(ctx context.Context, id string) error {
	return fmt.Errorf("Delete not implemented in mock")
}

func (m *mockPhotoRepository) ListByGallery(ctx context.Context, galleryID string, limit int, lastEvaluatedKey map[string]interface{}) ([]*repository.Photo, map[string]interface{}, error) {
	return nil, nil, fmt.Errorf("ListByGallery not implemented in mock")
}

func (m *mockPhotoRepository) IncrementFavoriteCount(ctx context.Context, photoID string, delta int) error {
	return fmt.Errorf("IncrementFavoriteCount not implemented in mock")
}

func (m *mockPhotoRepository) IncrementDownloadCount(ctx context.Context, photoID string) error {
	return fmt.Errorf("IncrementDownloadCount not implemented in mock")
}

// Helper function to create test image
func createTestImage(width, height int) stdimage.Image {
	img := stdimage.NewRGBA(stdimage.Rect(0, 0, width, height))
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

func TestExtractPhotoID(t *testing.T) {
	tests := []struct {
		name      string
		objectKey string
		want      string
		wantErr   bool
	}{
		{
			name:      "valid key with gallery and photo",
			objectKey: "galleries/gallery-123/photos/photo-456/original.jpg",
			want:      "photo-456",
			wantErr:   false,
		},
		{
			name:      "valid key with different extension",
			objectKey: "galleries/gallery-abc/photos/photo-xyz/original.png",
			want:      "photo-xyz",
			wantErr:   false,
		},
		{
			name:      "invalid key - too short",
			objectKey: "galleries/gallery-123",
			want:      "",
			wantErr:   true,
		},
		{
			name:      "invalid key - missing photos part",
			objectKey: "galleries/gallery-123/images/photo-456/original.jpg",
			want:      "",
			wantErr:   true,
		},
		{
			name:      "invalid key - empty",
			objectKey: "",
			want:      "",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := extractPhotoID(tt.objectKey)
			if (err != nil) != tt.wantErr {
				t.Errorf("extractPhotoID() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("extractPhotoID() = %v, want %v", got, tt.want)
			}
		})
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
			name:   "change jpg to webp",
			key:    "photo.jpg",
			newExt: ".webp",
			want:   "photo.webp",
		},
		{
			name:   "change png to jpg",
			key:    "image.png",
			newExt: ".jpg",
			want:   "image.jpg",
		},
		{
			name:   "key with path",
			key:    "galleries/123/photos/456/original.jpg",
			newExt: ".webp",
			want:   "galleries/123/photos/456/original.webp",
		},
		{
			name:   "key without extension",
			key:    "photo",
			newExt: ".jpg",
			want:   "photo.jpg",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := changeExtension(tt.key, tt.newExt)
			if got != tt.want {
				t.Errorf("changeExtension() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUpdatePhotoStatus(t *testing.T) {
	tests := []struct {
		name      string
		photoID   string
		status    string
		mockPhoto *repository.Photo
		mockError error
		wantErr   bool
	}{
		{
			name:    "update to processing",
			photoID: "photo-123",
			status:  "processing",
			mockPhoto: &repository.Photo{
				PhotoID:          "photo-123",
				ProcessingStatus: "pending",
			},
			mockError: nil,
			wantErr:   false,
		},
		{
			name:    "update to completed",
			photoID: "photo-123",
			status:  "completed",
			mockPhoto: &repository.Photo{
				PhotoID:          "photo-123",
				ProcessingStatus: "processing",
			},
			mockError: nil,
			wantErr:   false,
		},
		{
			name:      "photo not found",
			photoID:   "photo-999",
			status:    "processing",
			mockPhoto: nil,
			mockError: nil,
			wantErr:   true,
		},
		{
			name:      "database error on get",
			photoID:   "photo-123",
			status:    "processing",
			mockPhoto: nil,
			mockError: fmt.Errorf("database error"),
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock repository
			mockRepo := &mockPhotoRepository{
				getByIDFunc: func(ctx context.Context, id string) (*repository.Photo, error) {
					if tt.mockError != nil {
						return nil, tt.mockError
					}
					return tt.mockPhoto, nil
				},
				updateFunc: func(ctx context.Context, photo *repository.Photo) error {
					// Verify status was updated
					if photo.ProcessingStatus != tt.status {
						t.Errorf("Status not updated correctly: got %v, want %v", photo.ProcessingStatus, tt.status)
					}
					// Verify ProcessedAt is set for completed/failed
					if (tt.status == "completed" || tt.status == "failed") && photo.ProcessedAt == nil {
						t.Error("ProcessedAt should be set for completed/failed status")
					}
					return nil
				},
			}

			app := &App{
				cfg: &Config{
					S3BucketOriginal:  "test-original",
					S3BucketOptimized: "test-optimized",
					S3BucketThumbnail: "test-thumbnail",
				},
				photoRepo: mockRepo,
				processor: image.NewProcessor(),
			}

			err := app.updatePhotoStatus(context.Background(), tt.photoID, tt.status)
			if (err != nil) != tt.wantErr {
				t.Errorf("updatePhotoStatus() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
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
		{
			name:      "successful upload",
			bucket:    "test-bucket",
			key:       "test-key",
			data:      []byte("test data"),
			mockError: nil,
			wantErr:   false,
		},
		{
			name:      "upload error",
			bucket:    "test-bucket",
			key:       "test-key",
			data:      []byte("test data"),
			mockError: fmt.Errorf("S3 error"),
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockS3 := &mockS3Client{
				putObjectFunc: func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
					// Verify parameters
					if *params.Bucket != tt.bucket {
						t.Errorf("Bucket = %v, want %v", *params.Bucket, tt.bucket)
					}
					if *params.Key != tt.key {
						t.Errorf("Key = %v, want %v", *params.Key, tt.key)
					}
					return &s3.PutObjectOutput{}, tt.mockError
				},
			}

			app := &App{
				cfg: &Config{
					S3BucketOriginal:  "test-original",
					S3BucketOptimized: "test-optimized",
					S3BucketThumbnail: "test-thumbnail",
				},
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
	// Create test image data
	testImg := createTestImage(1920, 1080)
	var imgBuf bytes.Buffer
	jpeg.Encode(&imgBuf, testImg, nil)
	testImageData := imgBuf.Bytes()

	tests := []struct {
		name           string
		photoID        string
		objectKey      string
		mockS3Get      func(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error)
		mockS3Put      func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error)
		mockPhotoGet   func(ctx context.Context, id string) (*repository.Photo, error)
		mockPhotoUpdate func(ctx context.Context, photo *repository.Photo) error
		wantErr        bool
	}{
		{
			name:      "successful processing",
			photoID:   "photo-123",
			objectKey: "galleries/gallery-abc/photos/photo-123/original.jpg",
			mockS3Get: func(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
				return &s3.GetObjectOutput{
					Body: io.NopCloser(bytes.NewReader(testImageData)),
				}, nil
			},
			mockS3Put: func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
				return &s3.PutObjectOutput{}, nil
			},
			mockPhotoGet: func(ctx context.Context, id string) (*repository.Photo, error) {
				return &repository.Photo{
					PhotoID:          "photo-123",
					GalleryID:        "gallery-abc",
					ProcessingStatus: "pending",
					Metadata:         make(map[string]string),
				}, nil
			},
			mockPhotoUpdate: func(ctx context.Context, photo *repository.Photo) error {
				return nil
			},
			wantErr: false,
		},
		{
			name:      "S3 download error",
			photoID:   "photo-123",
			objectKey: "galleries/gallery-abc/photos/photo-123/original.jpg",
			mockS3Get: func(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
				return nil, fmt.Errorf("S3 download error")
			},
			mockPhotoGet: func(ctx context.Context, id string) (*repository.Photo, error) {
				return &repository.Photo{
					PhotoID:          "photo-123",
					ProcessingStatus: "pending",
				}, nil
			},
			mockPhotoUpdate: func(ctx context.Context, photo *repository.Photo) error {
				return nil
			},
			wantErr: true,
		},
		{
			name:      "photo not found in database",
			photoID:   "photo-999",
			objectKey: "galleries/gallery-abc/photos/photo-999/original.jpg",
			mockS3Get: func(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
				return &s3.GetObjectOutput{
					Body: io.NopCloser(bytes.NewReader(testImageData)),
				}, nil
			},
			mockS3Put: func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
				return &s3.PutObjectOutput{}, nil
			},
			mockPhotoGet: func(ctx context.Context, id string) (*repository.Photo, error) {
				return nil, nil // Not found
			},
			mockPhotoUpdate: func(ctx context.Context, photo *repository.Photo) error {
				return nil
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockS3 := &mockS3Client{
				getObjectFunc: tt.mockS3Get,
				putObjectFunc: tt.mockS3Put,
			}

			mockRepo := &mockPhotoRepository{
				getByIDFunc: tt.mockPhotoGet,
				updateFunc:  tt.mockPhotoUpdate,
			}

			app := &App{
				cfg: &Config{
					S3BucketOriginal:  "test-original",
					S3BucketOptimized: "test-optimized",
					S3BucketThumbnail: "test-thumbnail",
				},
				s3Client:  mockS3,
				photoRepo: mockRepo,
				processor: image.NewProcessor(),
			}

			err := app.processPhoto(context.Background(), tt.photoID, "test-bucket", tt.objectKey)
			if (err != nil) != tt.wantErr {
				t.Errorf("processPhoto() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestHandleS3Event(t *testing.T) {
	// Create test image data
	testImg := createTestImage(800, 600)
	var imgBuf bytes.Buffer
	jpeg.Encode(&imgBuf, testImg, nil)
	testImageData := imgBuf.Bytes()

	tests := []struct {
		name    string
		event   events.S3Event
		wantErr bool
	}{
		{
			name: "single valid event",
			event: events.S3Event{
				Records: []events.S3EventRecord{
					{
						S3: events.S3Entity{
							Bucket: events.S3Bucket{
								Name: "test-bucket",
							},
							Object: events.S3Object{
								Key: "galleries/gallery-123/photos/photo-456/original.jpg",
							},
						},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "multiple valid events",
			event: events.S3Event{
				Records: []events.S3EventRecord{
					{
						S3: events.S3Entity{
							Bucket: events.S3Bucket{
								Name: "test-bucket",
							},
							Object: events.S3Object{
								Key: "galleries/gallery-123/photos/photo-456/original.jpg",
							},
						},
					},
					{
						S3: events.S3Entity{
							Bucket: events.S3Bucket{
								Name: "test-bucket",
							},
							Object: events.S3Object{
								Key: "galleries/gallery-123/photos/photo-789/original.png",
							},
						},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "event with invalid object key",
			event: events.S3Event{
				Records: []events.S3EventRecord{
					{
						S3: events.S3Entity{
							Bucket: events.S3Bucket{
								Name: "test-bucket",
							},
							Object: events.S3Object{
								Key: "invalid-key",
							},
						},
					},
				},
			},
			wantErr: false, // Handler continues on individual failures
		},
		{
			name: "empty event",
			event: events.S3Event{
				Records: []events.S3EventRecord{},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockS3 := &mockS3Client{
				getObjectFunc: func(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
					return &s3.GetObjectOutput{
						Body: io.NopCloser(bytes.NewReader(testImageData)),
					}, nil
				},
				putObjectFunc: func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
					return &s3.PutObjectOutput{}, nil
				},
			}

			mockRepo := &mockPhotoRepository{
				getByIDFunc: func(ctx context.Context, id string) (*repository.Photo, error) {
					return &repository.Photo{
						PhotoID:          id,
						ProcessingStatus: "pending",
						Metadata:         make(map[string]string),
					}, nil
				},
				updateFunc: func(ctx context.Context, photo *repository.Photo) error {
					return nil
				},
			}

			app := &App{
				cfg: &Config{
					S3BucketOriginal:  "test-original",
					S3BucketOptimized: "test-optimized",
					S3BucketThumbnail: "test-thumbnail",
				},
				s3Client:  mockS3,
				photoRepo: mockRepo,
				processor: image.NewProcessor(),
			}

			err := app.handleS3Event(context.Background(), tt.event)
			if (err != nil) != tt.wantErr {
				t.Errorf("handleS3Event() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestProcessPhoto_InvalidImage(t *testing.T) {
	// Create invalid image data
	invalidImageData := []byte("not an image")

	mockS3 := &mockS3Client{
		getObjectFunc: func(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
			return &s3.GetObjectOutput{
				Body: io.NopCloser(bytes.NewReader(invalidImageData)),
			}, nil
		},
	}

	mockRepo := &mockPhotoRepository{
		getByIDFunc: func(ctx context.Context, id string) (*repository.Photo, error) {
			return &repository.Photo{
				PhotoID:          id,
				ProcessingStatus: "pending",
				Metadata:         make(map[string]string),
			}, nil
		},
		updateFunc: func(ctx context.Context, photo *repository.Photo) error {
			return nil
		},
	}

	app := &App{
		cfg: &Config{
			S3BucketOriginal:  "test-original",
			S3BucketOptimized: "test-optimized",
			S3BucketThumbnail: "test-thumbnail",
		},
		s3Client:  mockS3,
		photoRepo: mockRepo,
		processor: image.NewProcessor(),
	}

	err := app.processPhoto(context.Background(), "photo-123", "test-bucket", "galleries/gallery-abc/photos/photo-123/original.jpg")
	if err == nil {
		t.Error("processPhoto() should return error for invalid image data")
	}
}

func TestProcessPhoto_S3UploadFailure(t *testing.T) {
	// Create test image data
	testImg := createTestImage(800, 600)
	var imgBuf bytes.Buffer
	jpeg.Encode(&imgBuf, testImg, nil)
	testImageData := imgBuf.Bytes()

	uploadCount := 0
	mockS3 := &mockS3Client{
		getObjectFunc: func(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
			return &s3.GetObjectOutput{
				Body: io.NopCloser(bytes.NewReader(testImageData)),
			}, nil
		},
		putObjectFunc: func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
			uploadCount++
			// Fail on first upload (thumbnail)
			if uploadCount == 1 {
				return nil, fmt.Errorf("S3 upload error")
			}
			return &s3.PutObjectOutput{}, nil
		},
	}

	mockRepo := &mockPhotoRepository{
		getByIDFunc: func(ctx context.Context, id string) (*repository.Photo, error) {
			return &repository.Photo{
				PhotoID:          id,
				ProcessingStatus: "pending",
				Metadata:         make(map[string]string),
			}, nil
		},
		updateFunc: func(ctx context.Context, photo *repository.Photo) error {
			return nil
		},
	}

	app := &App{
		cfg: &Config{
			S3BucketOriginal:  "test-original",
			S3BucketOptimized: "test-optimized",
			S3BucketThumbnail: "test-thumbnail",
		},
		s3Client:  mockS3,
		photoRepo: mockRepo,
		processor: image.NewProcessor(),
	}

	err := app.processPhoto(context.Background(), "photo-123", "test-bucket", "galleries/gallery-abc/photos/photo-123/original.jpg")
	if err == nil {
		t.Error("processPhoto() should return error when S3 upload fails")
	}
}

func TestProcessPhoto_DatabaseUpdateFailure(t *testing.T) {
	// Create test image data
	testImg := createTestImage(800, 600)
	var imgBuf bytes.Buffer
	jpeg.Encode(&imgBuf, testImg, nil)
	testImageData := imgBuf.Bytes()

	mockS3 := &mockS3Client{
		getObjectFunc: func(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
			return &s3.GetObjectOutput{
				Body: io.NopCloser(bytes.NewReader(testImageData)),
			}, nil
		},
		putObjectFunc: func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
			return &s3.PutObjectOutput{}, nil
		},
	}

	updateCount := 0
	mockRepo := &mockPhotoRepository{
		getByIDFunc: func(ctx context.Context, id string) (*repository.Photo, error) {
			return &repository.Photo{
				PhotoID:          id,
				ProcessingStatus: "pending",
				Metadata:         make(map[string]string),
			}, nil
		},
		updateFunc: func(ctx context.Context, photo *repository.Photo) error {
			updateCount++
			// Succeed on first update (status to processing), fail on final update
			if updateCount > 1 {
				return fmt.Errorf("database update error")
			}
			return nil
		},
	}

	app := &App{
		cfg: &Config{
			S3BucketOriginal:  "test-original",
			S3BucketOptimized: "test-optimized",
			S3BucketThumbnail: "test-thumbnail",
		},
		s3Client:  mockS3,
		photoRepo: mockRepo,
		processor: image.NewProcessor(),
	}

	err := app.processPhoto(context.Background(), "photo-123", "test-bucket", "galleries/gallery-abc/photos/photo-123/original.jpg")
	if err == nil {
		t.Error("processPhoto() should return error when database update fails")
	}
}
