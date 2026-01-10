package repository

import (
	"context"
	"errors"
	"testing"
)

// MockGalleryRepository is a mock implementation for testing.
type MockGalleryRepository struct {
	CreateFunc                     func(ctx context.Context, gallery *Gallery) error
	GetByIDFunc                    func(ctx context.Context, galleryID string) (*Gallery, error)
	GetByCustomURLFunc             func(ctx context.Context, customURL string) (*Gallery, error)
	UpdateFunc                     func(ctx context.Context, gallery *Gallery) error
	DeleteFunc                     func(ctx context.Context, galleryID string) error
	ListByPhotographerFunc         func(ctx context.Context, photographerID string, limit int, lastKey map[string]interface{}) ([]*Gallery, map[string]interface{}, error)
	UpdatePhotoCountFunc           func(ctx context.Context, galleryID string, delta int) error
	ListExpiredFunc                func(ctx context.Context, limit int) ([]*Gallery, error)
	UpdateTotalSizeFunc            func(ctx context.Context, galleryID string, deltaBytes int64) error
	IncrementClientAccessCountFunc func(ctx context.Context, galleryID string) error
}

func (m *MockGalleryRepository) Create(ctx context.Context, gallery *Gallery) error {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, gallery)
	}
	return nil
}

func (m *MockGalleryRepository) GetByID(ctx context.Context, galleryID string) (*Gallery, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(ctx, galleryID)
	}
	return &Gallery{GalleryID: galleryID}, nil
}

func (m *MockGalleryRepository) GetByCustomURL(ctx context.Context, customURL string) (*Gallery, error) {
	if m.GetByCustomURLFunc != nil {
		return m.GetByCustomURLFunc(ctx, customURL)
	}
	return &Gallery{CustomURL: customURL}, nil
}

func (m *MockGalleryRepository) Update(ctx context.Context, gallery *Gallery) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, gallery)
	}
	return nil
}

func (m *MockGalleryRepository) Delete(ctx context.Context, galleryID string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, galleryID)
	}
	return nil
}

func (m *MockGalleryRepository) ListByPhotographer(ctx context.Context, photographerID string, limit int, lastKey map[string]interface{}) ([]*Gallery, map[string]interface{}, error) {
	if m.ListByPhotographerFunc != nil {
		return m.ListByPhotographerFunc(ctx, photographerID, limit, lastKey)
	}
	return []*Gallery{}, nil, nil
}

func (m *MockGalleryRepository) UpdatePhotoCount(ctx context.Context, galleryID string, delta int) error {
	if m.UpdatePhotoCountFunc != nil {
		return m.UpdatePhotoCountFunc(ctx, galleryID, delta)
	}
	return nil
}

func (m *MockGalleryRepository) ListExpired(ctx context.Context, limit int) ([]*Gallery, error) {
	if m.ListExpiredFunc != nil {
		return m.ListExpiredFunc(ctx, limit)
	}
	return []*Gallery{}, nil
}

func (m *MockGalleryRepository) UpdateTotalSize(ctx context.Context, galleryID string, deltaBytes int64) error {
	if m.UpdateTotalSizeFunc != nil {
		return m.UpdateTotalSizeFunc(ctx, galleryID, deltaBytes)
	}
	return nil
}

func (m *MockGalleryRepository) IncrementClientAccessCount(ctx context.Context, galleryID string) error {
	if m.IncrementClientAccessCountFunc != nil {
		return m.IncrementClientAccessCountFunc(ctx, galleryID)
	}
	return nil
}

func TestLoggingGalleryRepositoryCreate(t *testing.T) {
	mock := &MockGalleryRepository{}
	logged := NewLoggingGalleryRepository(mock)

	gallery := &Gallery{GalleryID: "gal_123", Name: "Test"}
	err := logged.Create(context.Background(), gallery)

	if err != nil {
		t.Errorf("Create() error = %v", err)
	}
}

func TestLoggingGalleryRepositoryCreateError(t *testing.T) {
	expectedErr := errors.New("database error")
	mock := &MockGalleryRepository{
		CreateFunc: func(ctx context.Context, gallery *Gallery) error {
			return expectedErr
		},
	}
	logged := NewLoggingGalleryRepository(mock)

	gallery := &Gallery{GalleryID: "gal_123"}
	err := logged.Create(context.Background(), gallery)

	if err != expectedErr {
		t.Errorf("Create() error = %v, want %v", err, expectedErr)
	}
}

func TestLoggingGalleryRepositoryGetByID(t *testing.T) {
	mock := &MockGalleryRepository{
		GetByIDFunc: func(ctx context.Context, galleryID string) (*Gallery, error) {
			return &Gallery{GalleryID: galleryID, Name: "Test"}, nil
		},
	}
	logged := NewLoggingGalleryRepository(mock)

	gallery, err := logged.GetByID(context.Background(), "gal_123")

	if err != nil {
		t.Errorf("GetByID() error = %v", err)
	}
	if gallery == nil || gallery.GalleryID != "gal_123" {
		t.Error("GetByID() returned incorrect gallery")
	}
}

func TestLoggingGalleryRepositoryGetByCustomURL(t *testing.T) {
	mock := &MockGalleryRepository{
		GetByCustomURLFunc: func(ctx context.Context, customURL string) (*Gallery, error) {
			return &Gallery{CustomURL: customURL}, nil
		},
	}
	logged := NewLoggingGalleryRepository(mock)

	gallery, err := logged.GetByCustomURL(context.Background(), "my-gallery")

	if err != nil {
		t.Errorf("GetByCustomURL() error = %v", err)
	}
	if gallery == nil || gallery.CustomURL != "my-gallery" {
		t.Error("GetByCustomURL() returned incorrect gallery")
	}
}

func TestLoggingGalleryRepositoryUpdate(t *testing.T) {
	mock := &MockGalleryRepository{}
	logged := NewLoggingGalleryRepository(mock)

	gallery := &Gallery{GalleryID: "gal_123", Name: "Updated"}
	err := logged.Update(context.Background(), gallery)

	if err != nil {
		t.Errorf("Update() error = %v", err)
	}
}

func TestLoggingGalleryRepositoryDelete(t *testing.T) {
	mock := &MockGalleryRepository{}
	logged := NewLoggingGalleryRepository(mock)

	err := logged.Delete(context.Background(), "gal_123")

	if err != nil {
		t.Errorf("Delete() error = %v", err)
	}
}

func TestLoggingGalleryRepositoryListByPhotographer(t *testing.T) {
	mock := &MockGalleryRepository{
		ListByPhotographerFunc: func(ctx context.Context, photographerID string, limit int, lastKey map[string]interface{}) ([]*Gallery, map[string]interface{}, error) {
			return []*Gallery{{GalleryID: "gal_1"}, {GalleryID: "gal_2"}}, nil, nil
		},
	}
	logged := NewLoggingGalleryRepository(mock)

	galleries, _, err := logged.ListByPhotographer(context.Background(), "user_123", 10, nil)

	if err != nil {
		t.Errorf("ListByPhotographer() error = %v", err)
	}
	if len(galleries) != 2 {
		t.Errorf("ListByPhotographer() returned %d galleries, want 2", len(galleries))
	}
}

func TestLoggingGalleryRepositoryUpdatePhotoCount(t *testing.T) {
	mock := &MockGalleryRepository{}
	logged := NewLoggingGalleryRepository(mock)

	err := logged.UpdatePhotoCount(context.Background(), "gal_123", 5)

	if err != nil {
		t.Errorf("UpdatePhotoCount() error = %v", err)
	}
}

// MockPhotoRepository is a mock implementation for testing.
type MockPhotoRepository struct {
	CreateFunc                 func(ctx context.Context, photo *Photo) error
	GetByIDFunc                func(ctx context.Context, photoID string) (*Photo, error)
	UpdateFunc                 func(ctx context.Context, photo *Photo) error
	DeleteFunc                 func(ctx context.Context, photoID string) error
	ListByGalleryFunc          func(ctx context.Context, galleryID string, limit int, lastKey map[string]interface{}) ([]*Photo, map[string]interface{}, error)
	IncrementFavoriteCountFunc func(ctx context.Context, photoID string, delta int) error
	IncrementDownloadCountFunc func(ctx context.Context, photoID string) error
}

func (m *MockPhotoRepository) Create(ctx context.Context, photo *Photo) error {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, photo)
	}
	return nil
}

func (m *MockPhotoRepository) GetByID(ctx context.Context, photoID string) (*Photo, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(ctx, photoID)
	}
	return &Photo{PhotoID: photoID}, nil
}

func (m *MockPhotoRepository) Update(ctx context.Context, photo *Photo) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, photo)
	}
	return nil
}

func (m *MockPhotoRepository) Delete(ctx context.Context, photoID string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, photoID)
	}
	return nil
}

func (m *MockPhotoRepository) ListByGallery(ctx context.Context, galleryID string, limit int, lastKey map[string]interface{}) ([]*Photo, map[string]interface{}, error) {
	if m.ListByGalleryFunc != nil {
		return m.ListByGalleryFunc(ctx, galleryID, limit, lastKey)
	}
	return []*Photo{}, nil, nil
}

func (m *MockPhotoRepository) IncrementFavoriteCount(ctx context.Context, photoID string, delta int) error {
	if m.IncrementFavoriteCountFunc != nil {
		return m.IncrementFavoriteCountFunc(ctx, photoID, delta)
	}
	return nil
}

func (m *MockPhotoRepository) IncrementDownloadCount(ctx context.Context, photoID string) error {
	if m.IncrementDownloadCountFunc != nil {
		return m.IncrementDownloadCountFunc(ctx, photoID)
	}
	return nil
}

func TestLoggingPhotoRepositoryCreate(t *testing.T) {
	mock := &MockPhotoRepository{}
	logged := NewLoggingPhotoRepository(mock)

	photo := &Photo{PhotoID: "photo_123", FileName: "test.jpg"}
	err := logged.Create(context.Background(), photo)

	if err != nil {
		t.Errorf("Create() error = %v", err)
	}
}

func TestLoggingPhotoRepositoryGetByID(t *testing.T) {
	mock := &MockPhotoRepository{
		GetByIDFunc: func(ctx context.Context, photoID string) (*Photo, error) {
			return &Photo{PhotoID: photoID, FileName: "test.jpg"}, nil
		},
	}
	logged := NewLoggingPhotoRepository(mock)

	photo, err := logged.GetByID(context.Background(), "photo_123")

	if err != nil {
		t.Errorf("GetByID() error = %v", err)
	}
	if photo == nil || photo.PhotoID != "photo_123" {
		t.Error("GetByID() returned incorrect photo")
	}
}

func TestLoggingPhotoRepositoryUpdate(t *testing.T) {
	mock := &MockPhotoRepository{}
	logged := NewLoggingPhotoRepository(mock)

	photo := &Photo{PhotoID: "photo_123"}
	err := logged.Update(context.Background(), photo)

	if err != nil {
		t.Errorf("Update() error = %v", err)
	}
}

func TestLoggingPhotoRepositoryDelete(t *testing.T) {
	mock := &MockPhotoRepository{}
	logged := NewLoggingPhotoRepository(mock)

	err := logged.Delete(context.Background(), "photo_123")

	if err != nil {
		t.Errorf("Delete() error = %v", err)
	}
}

func TestLoggingPhotoRepositoryListByGallery(t *testing.T) {
	mock := &MockPhotoRepository{
		ListByGalleryFunc: func(ctx context.Context, galleryID string, limit int, lastKey map[string]interface{}) ([]*Photo, map[string]interface{}, error) {
			return []*Photo{{PhotoID: "p1"}, {PhotoID: "p2"}, {PhotoID: "p3"}}, nil, nil
		},
	}
	logged := NewLoggingPhotoRepository(mock)

	photos, _, err := logged.ListByGallery(context.Background(), "gal_123", 10, nil)

	if err != nil {
		t.Errorf("ListByGallery() error = %v", err)
	}
	if len(photos) != 3 {
		t.Errorf("ListByGallery() returned %d photos, want 3", len(photos))
	}
}

func TestLoggingPhotoRepositoryIncrementFavoriteCount(t *testing.T) {
	mock := &MockPhotoRepository{}
	logged := NewLoggingPhotoRepository(mock)

	err := logged.IncrementFavoriteCount(context.Background(), "photo_123", 1)

	if err != nil {
		t.Errorf("IncrementFavoriteCount() error = %v", err)
	}
}

func TestLoggingPhotoRepositoryIncrementDownloadCount(t *testing.T) {
	mock := &MockPhotoRepository{}
	logged := NewLoggingPhotoRepository(mock)

	err := logged.IncrementDownloadCount(context.Background(), "photo_123")

	if err != nil {
		t.Errorf("IncrementDownloadCount() error = %v", err)
	}
}

func TestLoggingPhotoRepositoryError(t *testing.T) {
	expectedErr := errors.New("database error")
	mock := &MockPhotoRepository{
		GetByIDFunc: func(ctx context.Context, photoID string) (*Photo, error) {
			return nil, expectedErr
		},
	}
	logged := NewLoggingPhotoRepository(mock)

	_, err := logged.GetByID(context.Background(), "photo_123")

	if err != expectedErr {
		t.Errorf("GetByID() error = %v, want %v", err, expectedErr)
	}
}
