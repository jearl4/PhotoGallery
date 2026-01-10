package gallery

import (
	"context"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
	"photographer-gallery/backend/internal/repository"
	"photographer-gallery/backend/pkg/errors"
)

// Mock repositories
type mockGalleryRepo struct {
	galleries       map[string]*repository.Gallery
	customURLIndex  map[string]*repository.Gallery
	createErr       error
	getErr          error
	updateErr       error
	deleteErr       error
	listErr         error
}

func newMockGalleryRepo() *mockGalleryRepo {
	return &mockGalleryRepo{
		galleries:      make(map[string]*repository.Gallery),
		customURLIndex: make(map[string]*repository.Gallery),
	}
}

func (m *mockGalleryRepo) Create(ctx context.Context, gallery *repository.Gallery) error {
	if m.createErr != nil {
		return m.createErr
	}
	m.galleries[gallery.GalleryID] = gallery
	m.customURLIndex[gallery.CustomURL] = gallery
	return nil
}

func (m *mockGalleryRepo) GetByID(ctx context.Context, galleryID string) (*repository.Gallery, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	return m.galleries[galleryID], nil
}

func (m *mockGalleryRepo) GetByCustomURL(ctx context.Context, customURL string) (*repository.Gallery, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	return m.customURLIndex[customURL], nil
}

func (m *mockGalleryRepo) ListByPhotographer(ctx context.Context, photographerID string, limit int, lastKey map[string]interface{}) ([]*repository.Gallery, map[string]interface{}, error) {
	if m.listErr != nil {
		return nil, nil, m.listErr
	}
	var result []*repository.Gallery
	for _, g := range m.galleries {
		if g.PhotographerID == photographerID {
			result = append(result, g)
		}
	}
	return result, nil, nil
}

func (m *mockGalleryRepo) Update(ctx context.Context, gallery *repository.Gallery) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	if existing := m.galleries[gallery.GalleryID]; existing != nil {
		m.galleries[gallery.GalleryID] = gallery
		m.customURLIndex[gallery.CustomURL] = gallery
	}
	return nil
}

func (m *mockGalleryRepo) Delete(ctx context.Context, galleryID string) error {
	if m.deleteErr != nil {
		return m.deleteErr
	}
	if gallery := m.galleries[galleryID]; gallery != nil {
		delete(m.customURLIndex, gallery.CustomURL)
		delete(m.galleries, galleryID)
	}
	return nil
}

func (m *mockGalleryRepo) UpdatePhotoCount(ctx context.Context, galleryID string, delta int) error {
	if gallery := m.galleries[galleryID]; gallery != nil {
		gallery.PhotoCount += delta
	}
	return nil
}

func (m *mockGalleryRepo) UpdateTotalSize(ctx context.Context, galleryID string, delta int64) error {
	if gallery := m.galleries[galleryID]; gallery != nil {
		gallery.TotalSize += delta
	}
	return nil
}

func (m *mockGalleryRepo) IncrementClientAccessCount(ctx context.Context, galleryID string) error {
	if gallery := m.galleries[galleryID]; gallery != nil {
		gallery.ClientAccessCount++
	}
	return nil
}

func (m *mockGalleryRepo) ListExpired(ctx context.Context, limit int) ([]*repository.Gallery, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	var result []*repository.Gallery
	now := time.Now()
	for _, g := range m.galleries {
		if g.ExpiresAt != nil && g.ExpiresAt.Before(now) && g.Status == "active" {
			result = append(result, g)
		}
	}
	return result, nil
}

type mockPhotoRepo struct {
	photos    map[string]*repository.Photo
	deleteErr error
}

func newMockPhotoRepo() *mockPhotoRepo {
	return &mockPhotoRepo{
		photos: make(map[string]*repository.Photo),
	}
}

func (m *mockPhotoRepo) Create(ctx context.Context, photo *repository.Photo) error {
	m.photos[photo.PhotoID] = photo
	return nil
}
func (m *mockPhotoRepo) GetByID(ctx context.Context, photoID string) (*repository.Photo, error) {
	return m.photos[photoID], nil
}
func (m *mockPhotoRepo) ListByGallery(ctx context.Context, galleryID string, limit int, lastKey map[string]interface{}) ([]*repository.Photo, map[string]interface{}, error) {
	var result []*repository.Photo
	for _, p := range m.photos {
		if p.GalleryID == galleryID {
			result = append(result, p)
		}
	}
	return result, nil, nil
}
func (m *mockPhotoRepo) Update(ctx context.Context, photo *repository.Photo) error { return nil }
func (m *mockPhotoRepo) Delete(ctx context.Context, photoID string) error {
	if m.deleteErr != nil {
		return m.deleteErr
	}
	delete(m.photos, photoID)
	return nil
}
func (m *mockPhotoRepo) IncrementFavoriteCount(ctx context.Context, photoID string, delta int) error {
	return nil
}
func (m *mockPhotoRepo) IncrementDownloadCount(ctx context.Context, photoID string) error { return nil }

type mockStorageService struct {
	deletePhotoErr error
	deletedPhotos  []string
}

func (m *mockStorageService) DeletePhoto(ctx context.Context, originalKey, optimizedKey, thumbnailKey string) error {
	if m.deletePhotoErr != nil {
		return m.deletePhotoErr
	}
	m.deletedPhotos = append(m.deletedPhotos, originalKey)
	return nil
}

// Tests
func TestCreateGallery(t *testing.T) {
	galleryRepo := newMockGalleryRepo()
	photoRepo := newMockPhotoRepo()
	storageService := &mockStorageService{}
	service := NewService(galleryRepo, photoRepo, storageService)

	tests := []struct {
		name    string
		req     CreateGalleryRequest
		wantErr bool
		errType error
	}{
		{
			name: "successful creation with custom URL",
			req: CreateGalleryRequest{
				PhotographerID: "user_123",
				Name:           "Wedding Photos",
				Description:    "John and Jane Wedding",
				CustomURL:      "john-jane-wedding",
				Password:       "secure123",
			},
			wantErr: false,
		},
		{
			name: "successful creation with auto-generated URL",
			req: CreateGalleryRequest{
				PhotographerID: "user_123",
				Name:           "Birthday Party",
				Password:       "secure123",
			},
			wantErr: false,
		},
		{
			name: "invalid custom URL",
			req: CreateGalleryRequest{
				PhotographerID: "user_123",
				Name:           "Test Gallery",
				CustomURL:      "Invalid URL!",
				Password:       "secure123",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gallery, err := service.Create(context.Background(), tt.req)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Create() expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("Create() unexpected error: %v", err)
				return
			}

			if gallery == nil {
				t.Error("Create() returned nil gallery")
				return
			}

			// Verify gallery fields
			if gallery.PhotographerID != tt.req.PhotographerID {
				t.Errorf("PhotographerID = %v, want %v", gallery.PhotographerID, tt.req.PhotographerID)
			}

			if gallery.Name != tt.req.Name {
				t.Errorf("Name = %v, want %v", gallery.Name, tt.req.Name)
			}

			// Verify password was hashed
			if err := bcrypt.CompareHashAndPassword([]byte(gallery.Password), []byte(tt.req.Password)); err != nil {
				t.Error("Password was not hashed correctly")
			}

			// Verify status is active
			if gallery.Status != "active" {
				t.Errorf("Status = %v, want active", gallery.Status)
			}

			// Verify custom URL
			if tt.req.CustomURL != "" && gallery.CustomURL != tt.req.CustomURL {
				t.Errorf("CustomURL = %v, want %v", gallery.CustomURL, tt.req.CustomURL)
			}
		})
	}
}

func TestCreateGalleryDuplicateURL(t *testing.T) {
	galleryRepo := newMockGalleryRepo()
	photoRepo := newMockPhotoRepo()
	storageService := &mockStorageService{}
	service := NewService(galleryRepo, photoRepo, storageService)

	// Create first gallery
	req1 := CreateGalleryRequest{
		PhotographerID: "user_123",
		Name:           "First Gallery",
		CustomURL:      "my-gallery",
		Password:       "password123",
	}
	_, err := service.Create(context.Background(), req1)
	if err != nil {
		t.Fatalf("Failed to create first gallery: %v", err)
	}

	// Try to create second gallery with same URL
	req2 := CreateGalleryRequest{
		PhotographerID: "user_456",
		Name:           "Second Gallery",
		CustomURL:      "my-gallery",
		Password:       "password456",
	}
	_, err = service.Create(context.Background(), req2)
	if err == nil {
		t.Error("Create() should fail with duplicate custom URL")
	}

	appErr, ok := err.(*errors.AppError)
	if !ok || appErr.Code != 409 {
		t.Errorf("Expected 409 error, got: %v", err)
	}
}

func TestVerifyPassword(t *testing.T) {
	galleryRepo := newMockGalleryRepo()
	photoRepo := newMockPhotoRepo()
	storageService := &mockStorageService{}
	service := NewService(galleryRepo, photoRepo, storageService)

	// Create a gallery
	req := CreateGalleryRequest{
		PhotographerID: "user_123",
		Name:           "Test Gallery",
		CustomURL:      "test-gallery",
		Password:       "correct-password",
	}
	gallery, _ := service.Create(context.Background(), req)

	tests := []struct {
		name      string
		customURL string
		password  string
		wantErr   bool
	}{
		{
			name:      "correct password",
			customURL: "test-gallery",
			password:  "correct-password",
			wantErr:   false,
		},
		{
			name:      "incorrect password",
			customURL: "test-gallery",
			password:  "wrong-password",
			wantErr:   true,
		},
		{
			name:      "gallery not found",
			customURL: "nonexistent",
			password:  "password",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := service.VerifyPassword(context.Background(), tt.customURL, tt.password)

			if tt.wantErr {
				if err == nil {
					t.Error("VerifyPassword() expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("VerifyPassword() unexpected error: %v", err)
				return
			}

			if result.GalleryID != gallery.GalleryID {
				t.Errorf("GalleryID = %v, want %v", result.GalleryID, gallery.GalleryID)
			}
		})
	}
}

func TestVerifyPasswordExpiredGallery(t *testing.T) {
	galleryRepo := newMockGalleryRepo()
	photoRepo := newMockPhotoRepo()
	storageService := &mockStorageService{}
	service := NewService(galleryRepo, photoRepo, storageService)

	// Create expired gallery
	expiresAt := time.Now().Add(-24 * time.Hour)
	req := CreateGalleryRequest{
		PhotographerID: "user_123",
		Name:           "Expired Gallery",
		CustomURL:      "expired-gallery",
		Password:       "password123",
		ExpiresAt:      &expiresAt,
	}
	_, _ = service.Create(context.Background(), req)

	_, err := service.VerifyPassword(context.Background(), "expired-gallery", "password123")
	if err == nil {
		t.Error("VerifyPassword() should fail for expired gallery")
	}
}

func TestUpdateGallery(t *testing.T) {
	galleryRepo := newMockGalleryRepo()
	photoRepo := newMockPhotoRepo()
	storageService := &mockStorageService{}
	service := NewService(galleryRepo, photoRepo, storageService)

	// Create a gallery
	createReq := CreateGalleryRequest{
		PhotographerID: "user_123",
		Name:           "Original Name",
		Description:    "Original Description",
		CustomURL:      "test-gallery",
		Password:       "oldpassword",
	}
	gallery, _ := service.Create(context.Background(), createReq)

	// Update gallery
	newName := "Updated Name"
	newDesc := "Updated Description"
	newPass := "newpassword"
	updateReq := UpdateGalleryRequest{
		Name:        &newName,
		Description: &newDesc,
		Password:    &newPass,
	}

	updated, err := service.Update(context.Background(), gallery.GalleryID, updateReq)
	if err != nil {
		t.Fatalf("Update() error: %v", err)
	}

	if updated.Name != newName {
		t.Errorf("Name = %v, want %v", updated.Name, newName)
	}

	if updated.Description != newDesc {
		t.Errorf("Description = %v, want %v", updated.Description, newDesc)
	}

	// Verify new password
	if err := bcrypt.CompareHashAndPassword([]byte(updated.Password), []byte(newPass)); err != nil {
		t.Error("New password was not hashed correctly")
	}
}

func TestDeleteGallery(t *testing.T) {
	galleryRepo := newMockGalleryRepo()
	photoRepo := newMockPhotoRepo()
	storageService := &mockStorageService{}
	service := NewService(galleryRepo, photoRepo, storageService)

	// Create a gallery
	req := CreateGalleryRequest{
		PhotographerID: "user_123",
		Name:           "Test Gallery",
		CustomURL:      "test-gallery",
		Password:       "password123",
	}
	gallery, _ := service.Create(context.Background(), req)

	// Delete gallery
	err := service.Delete(context.Background(), gallery.GalleryID)
	if err != nil {
		t.Fatalf("Delete() error: %v", err)
	}

	// Verify it's gone
	result, _ := service.GetByID(context.Background(), gallery.GalleryID)
	if result != nil {
		t.Error("Gallery should be deleted")
	}
}

func TestSetExpiration(t *testing.T) {
	galleryRepo := newMockGalleryRepo()
	photoRepo := newMockPhotoRepo()
	storageService := &mockStorageService{}
	service := NewService(galleryRepo, photoRepo, storageService)

	// Create a gallery
	req := CreateGalleryRequest{
		PhotographerID: "user_123",
		Name:           "Test Gallery",
		CustomURL:      "test-gallery",
		Password:       "password123",
	}
	gallery, _ := service.Create(context.Background(), req)

	// Set expiration
	expiresAt := time.Now().Add(30 * 24 * time.Hour)
	updated, err := service.SetExpiration(context.Background(), gallery.GalleryID, &expiresAt)
	if err != nil {
		t.Fatalf("SetExpiration() error: %v", err)
	}

	if updated.ExpiresAt == nil {
		t.Error("ExpiresAt should be set")
	}

	if !updated.ExpiresAt.Equal(expiresAt) {
		t.Errorf("ExpiresAt = %v, want %v", updated.ExpiresAt, expiresAt)
	}
}

func TestProcessExpiredGalleries(t *testing.T) {
	galleryRepo := newMockGalleryRepo()
	photoRepo := newMockPhotoRepo()
	storageService := &mockStorageService{}
	service := NewService(galleryRepo, photoRepo, storageService)

	// Create expired gallery
	pastTime := time.Now().Add(-24 * time.Hour)
	req := CreateGalleryRequest{
		PhotographerID: "user_123",
		Name:           "Expired Gallery",
		CustomURL:      "expired-gallery",
		Password:       "password123",
		ExpiresAt:      &pastTime,
	}
	gallery, _ := service.Create(context.Background(), req)

	// Process expired galleries
	err := service.ProcessExpiredGalleries(context.Background(), 10)
	if err != nil {
		t.Fatalf("ProcessExpiredGalleries() error: %v", err)
	}

	// Verify gallery was deleted (ProcessExpiredGalleries deletes expired galleries)
	updated, err := service.GetByID(context.Background(), gallery.GalleryID)
	if err == nil && updated != nil {
		t.Errorf("Expected gallery to be deleted, but it still exists")
	}
}

func TestListByPhotographer(t *testing.T) {
	galleryRepo := newMockGalleryRepo()
	photoRepo := newMockPhotoRepo()
	storageService := &mockStorageService{}
	service := NewService(galleryRepo, photoRepo, storageService)

	photographerID := "user_123"

	// Create multiple galleries
	for i := 0; i < 3; i++ {
		req := CreateGalleryRequest{
			PhotographerID: photographerID,
			Name:           "Gallery",
			Password:       "password",
		}
		_, _ = service.Create(context.Background(), req)
	}

	// List galleries
	galleries, _, err := service.ListByPhotographer(context.Background(), photographerID, 10, nil)
	if err != nil {
		t.Fatalf("ListByPhotographer() error: %v", err)
	}

	if len(galleries) != 3 {
		t.Errorf("Expected 3 galleries, got %d", len(galleries))
	}
}

func TestDeleteGalleryWithPhotos(t *testing.T) {
	galleryRepo := newMockGalleryRepo()
	photoRepo := newMockPhotoRepo()
	storageService := &mockStorageService{deletedPhotos: []string{}}
	service := NewService(galleryRepo, photoRepo, storageService)

	// Create a gallery
	req := CreateGalleryRequest{
		PhotographerID: "user_123",
		Name:           "Test Gallery",
		CustomURL:      "test-gallery",
		Password:       "password123",
	}
	gallery, _ := service.Create(context.Background(), req)

	// Add some photos
	photos := []*repository.Photo{
		{
			PhotoID:      "photo_1",
			GalleryID:    gallery.GalleryID,
			OriginalKey:  gallery.GalleryID + "/photo_1/original.jpg",
			OptimizedKey: gallery.GalleryID + "/photo_1/optimized.jpg",
			ThumbnailKey: gallery.GalleryID + "/photo_1/thumbnail.jpg",
		},
		{
			PhotoID:      "photo_2",
			GalleryID:    gallery.GalleryID,
			OriginalKey:  gallery.GalleryID + "/photo_2/original.jpg",
			OptimizedKey: gallery.GalleryID + "/photo_2/optimized.jpg",
			ThumbnailKey: gallery.GalleryID + "/photo_2/thumbnail.jpg",
		},
	}

	for _, photo := range photos {
		photoRepo.Create(context.Background(), photo)
	}

	// Delete gallery
	err := service.Delete(context.Background(), gallery.GalleryID)
	if err != nil {
		t.Fatalf("Delete() error: %v", err)
	}

	// Verify gallery is deleted
	result, _ := service.GetByID(context.Background(), gallery.GalleryID)
	if result != nil {
		t.Error("Gallery should be deleted")
	}

	// Verify photos are deleted from repo
	remainingPhotos, _, _ := photoRepo.ListByGallery(context.Background(), gallery.GalleryID, 100, nil)
	if len(remainingPhotos) != 0 {
		t.Errorf("Expected 0 photos, got %d", len(remainingPhotos))
	}

	// Verify S3 delete was called for each photo
	if len(storageService.deletedPhotos) != 2 {
		t.Errorf("Expected 2 S3 deletions, got %d", len(storageService.deletedPhotos))
	}
}
