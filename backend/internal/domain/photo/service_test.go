package photo

import (
	"context"
	"testing"
	"time"

	"photographer-gallery/backend/internal/repository"
)

// Mock repositories
type mockPhotoRepo struct {
	photos          map[string]*repository.Photo
	createErr       error
	getErr          error
	deleteErr       error
	listErr         error
	favoriteCount   int
	downloadCount   int
}

func newMockPhotoRepo() *mockPhotoRepo {
	return &mockPhotoRepo{
		photos: make(map[string]*repository.Photo),
	}
}

func (m *mockPhotoRepo) Create(ctx context.Context, photo *repository.Photo) error {
	if m.createErr != nil {
		return m.createErr
	}
	m.photos[photo.PhotoID] = photo
	return nil
}

func (m *mockPhotoRepo) GetByID(ctx context.Context, photoID string) (*repository.Photo, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	return m.photos[photoID], nil
}

func (m *mockPhotoRepo) ListByGallery(ctx context.Context, galleryID string, limit int, lastKey map[string]interface{}) ([]*repository.Photo, map[string]interface{}, error) {
	if m.listErr != nil {
		return nil, nil, m.listErr
	}
	var result []*repository.Photo
	for _, p := range m.photos {
		if p.GalleryID == galleryID {
			result = append(result, p)
		}
	}
	return result, nil, nil
}

func (m *mockPhotoRepo) Update(ctx context.Context, photo *repository.Photo) error {
	if existing := m.photos[photo.PhotoID]; existing != nil {
		m.photos[photo.PhotoID] = photo
	}
	return nil
}

func (m *mockPhotoRepo) Delete(ctx context.Context, photoID string) error {
	if m.deleteErr != nil {
		return m.deleteErr
	}
	delete(m.photos, photoID)
	return nil
}

func (m *mockPhotoRepo) IncrementFavoriteCount(ctx context.Context, photoID string, delta int) error {
	m.favoriteCount += delta
	if photo := m.photos[photoID]; photo != nil {
		photo.FavoriteCount += delta
	}
	return nil
}

func (m *mockPhotoRepo) IncrementDownloadCount(ctx context.Context, photoID string) error {
	m.downloadCount++
	if photo := m.photos[photoID]; photo != nil {
		photo.DownloadCount++
	}
	return nil
}

type mockGalleryRepo struct {
	galleries    map[string]*repository.Gallery
	photoCount   int
	totalSize    int64
}

func newMockGalleryRepo() *mockGalleryRepo {
	return &mockGalleryRepo{
		galleries: make(map[string]*repository.Gallery),
	}
}

func (m *mockGalleryRepo) GetByID(ctx context.Context, galleryID string) (*repository.Gallery, error) {
	return m.galleries[galleryID], nil
}

func (m *mockGalleryRepo) UpdatePhotoCount(ctx context.Context, galleryID string, delta int) error {
	m.photoCount += delta
	return nil
}

func (m *mockGalleryRepo) UpdateTotalSize(ctx context.Context, galleryID string, delta int64) error {
	m.totalSize += delta
	return nil
}

func (m *mockGalleryRepo) Create(ctx context.Context, gallery *repository.Gallery) error { return nil }
func (m *mockGalleryRepo) GetByCustomURL(ctx context.Context, customURL string) (*repository.Gallery, error) {
	return nil, nil
}
func (m *mockGalleryRepo) ListByPhotographer(ctx context.Context, photographerID string, limit int, lastKey map[string]interface{}) ([]*repository.Gallery, map[string]interface{}, error) {
	return nil, nil, nil
}
func (m *mockGalleryRepo) Update(ctx context.Context, gallery *repository.Gallery) error { return nil }
func (m *mockGalleryRepo) Delete(ctx context.Context, galleryID string) error            { return nil }
func (m *mockGalleryRepo) IncrementClientAccessCount(ctx context.Context, galleryID string) error {
	return nil
}
func (m *mockGalleryRepo) ListExpired(ctx context.Context, limit int) ([]*repository.Gallery, error) {
	return nil, nil
}

type mockFavoriteRepo struct {
	favorites   map[string]*repository.Favorite
	favorited   bool
	createErr   error
	deleteErr   error
	listErr     error
}

func newMockFavoriteRepo() *mockFavoriteRepo {
	return &mockFavoriteRepo{
		favorites: make(map[string]*repository.Favorite),
	}
}

func (m *mockFavoriteRepo) Create(ctx context.Context, favorite *repository.Favorite) error {
	if m.createErr != nil {
		return m.createErr
	}
	key := favorite.GalleryID + "#" + favorite.SessionID + "#" + favorite.PhotoID
	m.favorites[key] = favorite
	m.favorited = true
	return nil
}

func (m *mockFavoriteRepo) Delete(ctx context.Context, galleryID, sessionID, photoID string) error {
	if m.deleteErr != nil {
		return m.deleteErr
	}
	key := galleryID + "#" + sessionID + "#" + photoID
	delete(m.favorites, key)
	m.favorited = false
	return nil
}

func (m *mockFavoriteRepo) IsFavorited(ctx context.Context, galleryID, sessionID, photoID string) (bool, error) {
	return m.favorited, nil
}

func (m *mockFavoriteRepo) ListBySession(ctx context.Context, galleryID, sessionID string) ([]*repository.Favorite, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	var result []*repository.Favorite
	prefix := galleryID + "#" + sessionID
	for key, fav := range m.favorites {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			result = append(result, fav)
		}
	}
	return result, nil
}

func (m *mockFavoriteRepo) ListByGallery(ctx context.Context, galleryID string) ([]*repository.Favorite, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	var result []*repository.Favorite
	for _, fav := range m.favorites {
		if fav.GalleryID == galleryID {
			result = append(result, fav)
		}
	}
	return result, nil
}

// Tests - focusing on business logic without storage service
func TestCreatePhoto(t *testing.T) {
	photoRepo := newMockPhotoRepo()
	galleryRepo := newMockGalleryRepo()
	favoriteRepo := newMockFavoriteRepo()

	// Create a gallery
	gallery := &repository.Gallery{
		GalleryID:      "gal_123",
		PhotographerID: "user_123",
		Status:         "active",
	}
	galleryRepo.galleries["gal_123"] = gallery

	service := NewService(photoRepo, galleryRepo, favoriteRepo, nil)

	req := CreatePhotoRequest{
		PhotoID:      "photo_123",
		GalleryID:    "gal_123",
		FileName:     "photo.jpg",
		OriginalKey:  "originals/gal_123/photo_123.jpg",
		OptimizedKey: "optimized/gal_123/photo_123.jpg",
		ThumbnailKey: "thumbnails/gal_123/photo_123.jpg",
		MimeType:     "image/jpeg",
		Size:         1024000,
		Width:        1920,
		Height:       1080,
	}

	photo, err := service.Create(context.Background(), req)
	if err != nil {
		t.Fatalf("Create() error: %v", err)
	}

	if photo.PhotoID != req.PhotoID {
		t.Errorf("PhotoID = %v, want %v", photo.PhotoID, req.PhotoID)
	}

	if photo.GalleryID != req.GalleryID {
		t.Errorf("GalleryID = %v, want %v", photo.GalleryID, req.GalleryID)
	}

	// Verify gallery stats were updated
	if galleryRepo.photoCount != 1 {
		t.Errorf("Gallery photo count = %d, want 1", galleryRepo.photoCount)
	}

	if galleryRepo.totalSize != req.Size {
		t.Errorf("Gallery total size = %d, want %d", galleryRepo.totalSize, req.Size)
	}
}

func TestGetPhotoByID(t *testing.T) {
	photoRepo := newMockPhotoRepo()
	galleryRepo := newMockGalleryRepo()
	favoriteRepo := newMockFavoriteRepo()

	service := NewService(photoRepo, galleryRepo, favoriteRepo, nil)

	// Create a photo
	photo := &repository.Photo{
		PhotoID:   "photo_123",
		GalleryID: "gal_123",
		FileName:  "photo.jpg",
	}
	photoRepo.photos["photo_123"] = photo

	result, err := service.GetByID(context.Background(), "photo_123")
	if err != nil {
		t.Fatalf("GetByID() error: %v", err)
	}

	if result.PhotoID != photo.PhotoID {
		t.Errorf("PhotoID = %v, want %v", result.PhotoID, photo.PhotoID)
	}
}

func TestGetPhotoByIDNotFound(t *testing.T) {
	photoRepo := newMockPhotoRepo()
	galleryRepo := newMockGalleryRepo()
	favoriteRepo := newMockFavoriteRepo()

	service := NewService(photoRepo, galleryRepo, favoriteRepo, nil)

	_, err := service.GetByID(context.Background(), "nonexistent")
	if err == nil {
		t.Error("GetByID() should fail for nonexistent photo")
	}
}

func TestListPhotosByGallery(t *testing.T) {
	photoRepo := newMockPhotoRepo()
	galleryRepo := newMockGalleryRepo()
	favoriteRepo := newMockFavoriteRepo()

	service := NewService(photoRepo, galleryRepo, favoriteRepo, nil)

	galleryID := "gal_123"

	// Create multiple photos
	for i := 0; i < 5; i++ {
		photoRepo.photos["photo_"+string(rune(i))] = &repository.Photo{
			PhotoID:   "photo_" + string(rune(i)),
			GalleryID: galleryID,
		}
	}

	photos, _, err := service.ListByGallery(context.Background(), galleryID, 10, nil)
	if err != nil {
		t.Fatalf("ListByGallery() error: %v", err)
	}

	if len(photos) != 5 {
		t.Errorf("Expected 5 photos, got %d", len(photos))
	}
}

func TestToggleFavorite(t *testing.T) {
	photoRepo := newMockPhotoRepo()
	galleryRepo := newMockGalleryRepo()
	favoriteRepo := newMockFavoriteRepo()

	service := NewService(photoRepo, galleryRepo, favoriteRepo, nil)

	// Create a photo
	photo := &repository.Photo{
		PhotoID:       "photo_123",
		GalleryID:     "gal_123",
		FavoriteCount: 0,
	}
	photoRepo.photos["photo_123"] = photo

	galleryID := "gal_123"
	sessionID := "session_456"
	photoID := "photo_123"

	// Test adding favorite
	t.Run("add favorite", func(t *testing.T) {
		isFavorited, err := service.ToggleFavorite(context.Background(), galleryID, sessionID, photoID)
		if err != nil {
			t.Fatalf("ToggleFavorite() error: %v", err)
		}

		if !isFavorited {
			t.Error("Photo should be favorited")
		}

		if photoRepo.favoriteCount != 1 {
			t.Errorf("Favorite count = %d, want 1", photoRepo.favoriteCount)
		}
	})

	// Test removing favorite
	t.Run("remove favorite", func(t *testing.T) {
		isFavorited, err := service.ToggleFavorite(context.Background(), galleryID, sessionID, photoID)
		if err != nil {
			t.Fatalf("ToggleFavorite() error: %v", err)
		}

		if isFavorited {
			t.Error("Photo should not be favorited")
		}

		if photoRepo.favoriteCount != 0 {
			t.Errorf("Favorite count = %d, want 0", photoRepo.favoriteCount)
		}
	})
}

func TestListFavoritesBySession(t *testing.T) {
	photoRepo := newMockPhotoRepo()
	galleryRepo := newMockGalleryRepo()
	favoriteRepo := newMockFavoriteRepo()

	service := NewService(photoRepo, galleryRepo, favoriteRepo, nil)

	galleryID := "gal_123"
	sessionID := "session_456"

	// Add some favorites
	favorites := []*repository.Favorite{
		{GalleryID: galleryID, SessionID: sessionID, PhotoID: "photo_1", FavoritedAt: time.Now()},
		{GalleryID: galleryID, SessionID: sessionID, PhotoID: "photo_2", FavoritedAt: time.Now()},
	}

	for _, fav := range favorites {
		key := fav.GalleryID + "#" + fav.SessionID + "#" + fav.PhotoID
		favoriteRepo.favorites[key] = fav
	}

	// List favorites
	result, err := service.ListFavoritesBySession(context.Background(), galleryID, sessionID)
	if err != nil {
		t.Fatalf("ListFavoritesBySession() error: %v", err)
	}

	if len(result) != 2 {
		t.Errorf("Expected 2 favorites, got %d", len(result))
	}
}

func TestListFavoritesByGallery(t *testing.T) {
	photoRepo := newMockPhotoRepo()
	galleryRepo := newMockGalleryRepo()
	favoriteRepo := newMockFavoriteRepo()

	service := NewService(photoRepo, galleryRepo, favoriteRepo, nil)

	galleryID := "gal_123"

	// Add favorites from different sessions
	favorites := []*repository.Favorite{
		{GalleryID: galleryID, SessionID: "session_1", PhotoID: "photo_1", FavoritedAt: time.Now()},
		{GalleryID: galleryID, SessionID: "session_2", PhotoID: "photo_2", FavoritedAt: time.Now()},
		{GalleryID: galleryID, SessionID: "session_3", PhotoID: "photo_3", FavoritedAt: time.Now()},
	}

	for _, fav := range favorites {
		favoriteRepo.favorites[fav.PhotoID] = fav
	}

	// List all favorites for gallery
	result, err := service.ListFavoritesByGallery(context.Background(), galleryID)
	if err != nil {
		t.Fatalf("ListFavoritesByGallery() error: %v", err)
	}

	if len(result) != 3 {
		t.Errorf("Expected 3 favorites, got %d", len(result))
	}
}

func TestIsValidImageType(t *testing.T) {
	tests := []struct {
		mimeType string
		valid    bool
	}{
		{"image/jpeg", true},
		{"image/jpg", true},
		{"image/png", true},
		{"image/webp", true},
		{"image/gif", false},
		{"application/pdf", false},
		{"text/plain", false},
	}

	for _, tt := range tests {
		t.Run(tt.mimeType, func(t *testing.T) {
			result := isValidImageType(tt.mimeType)
			if result != tt.valid {
				t.Errorf("isValidImageType(%v) = %v, want %v", tt.mimeType, result, tt.valid)
			}
		})
	}
}
