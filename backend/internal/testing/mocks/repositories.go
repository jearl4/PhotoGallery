// Package mocks provides mock implementations of repository interfaces for testing.
package mocks

import (
	"context"
	"sync"
	"time"

	"photographer-gallery/backend/internal/repository"
)

// MockGalleryRepository is a mock implementation of GalleryRepository.
type MockGalleryRepository struct {
	mu              sync.RWMutex
	galleries       map[string]*repository.Gallery
	customURLIndex  map[string]*repository.Gallery
	CreateErr       error
	GetByIDErr      error
	GetByURLErr     error
	UpdateErr       error
	DeleteErr       error
	ListErr         error
}

// NewMockGalleryRepository creates a new mock gallery repository.
func NewMockGalleryRepository() *MockGalleryRepository {
	return &MockGalleryRepository{
		galleries:      make(map[string]*repository.Gallery),
		customURLIndex: make(map[string]*repository.Gallery),
	}
}

func (m *MockGalleryRepository) Create(ctx context.Context, gallery *repository.Gallery) error {
	if m.CreateErr != nil {
		return m.CreateErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.galleries[gallery.GalleryID] = gallery
	m.customURLIndex[gallery.CustomURL] = gallery
	return nil
}

func (m *MockGalleryRepository) GetByID(ctx context.Context, galleryID string) (*repository.Gallery, error) {
	if m.GetByIDErr != nil {
		return nil, m.GetByIDErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.galleries[galleryID], nil
}

func (m *MockGalleryRepository) GetByCustomURL(ctx context.Context, customURL string) (*repository.Gallery, error) {
	if m.GetByURLErr != nil {
		return nil, m.GetByURLErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.customURLIndex[customURL], nil
}

func (m *MockGalleryRepository) ListByPhotographer(ctx context.Context, photographerID string, limit int, lastKey map[string]interface{}) ([]*repository.Gallery, map[string]interface{}, error) {
	if m.ListErr != nil {
		return nil, nil, m.ListErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []*repository.Gallery
	for _, g := range m.galleries {
		if g.PhotographerID == photographerID {
			result = append(result, g)
		}
	}
	return result, nil, nil
}

func (m *MockGalleryRepository) Update(ctx context.Context, gallery *repository.Gallery) error {
	if m.UpdateErr != nil {
		return m.UpdateErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if existing := m.galleries[gallery.GalleryID]; existing != nil {
		delete(m.customURLIndex, existing.CustomURL)
		m.galleries[gallery.GalleryID] = gallery
		m.customURLIndex[gallery.CustomURL] = gallery
	}
	return nil
}

func (m *MockGalleryRepository) Delete(ctx context.Context, galleryID string) error {
	if m.DeleteErr != nil {
		return m.DeleteErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if gallery := m.galleries[galleryID]; gallery != nil {
		delete(m.customURLIndex, gallery.CustomURL)
		delete(m.galleries, galleryID)
	}
	return nil
}

func (m *MockGalleryRepository) ListExpired(ctx context.Context, limit int) ([]*repository.Gallery, error) {
	if m.ListErr != nil {
		return nil, m.ListErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []*repository.Gallery
	now := time.Now()
	for _, g := range m.galleries {
		if g.ExpiresAt != nil && g.ExpiresAt.Before(now) && g.Status == "active" {
			result = append(result, g)
		}
	}
	return result, nil
}

func (m *MockGalleryRepository) UpdatePhotoCount(ctx context.Context, galleryID string, delta int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if gallery := m.galleries[galleryID]; gallery != nil {
		gallery.PhotoCount += delta
	}
	return nil
}

func (m *MockGalleryRepository) UpdateTotalSize(ctx context.Context, galleryID string, delta int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if gallery := m.galleries[galleryID]; gallery != nil {
		gallery.TotalSize += delta
	}
	return nil
}

func (m *MockGalleryRepository) IncrementClientAccessCount(ctx context.Context, galleryID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if gallery := m.galleries[galleryID]; gallery != nil {
		gallery.ClientAccessCount++
	}
	return nil
}

// AddGallery directly adds a gallery for test setup.
func (m *MockGalleryRepository) AddGallery(gallery *repository.Gallery) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.galleries[gallery.GalleryID] = gallery
	m.customURLIndex[gallery.CustomURL] = gallery
}

// MockPhotoRepository is a mock implementation of PhotoRepository.
type MockPhotoRepository struct {
	mu        sync.RWMutex
	photos    map[string]*repository.Photo
	CreateErr error
	GetErr    error
	UpdateErr error
	DeleteErr error
	ListErr   error
}

// NewMockPhotoRepository creates a new mock photo repository.
func NewMockPhotoRepository() *MockPhotoRepository {
	return &MockPhotoRepository{
		photos: make(map[string]*repository.Photo),
	}
}

func (m *MockPhotoRepository) Create(ctx context.Context, photo *repository.Photo) error {
	if m.CreateErr != nil {
		return m.CreateErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.photos[photo.PhotoID] = photo
	return nil
}

func (m *MockPhotoRepository) GetByID(ctx context.Context, photoID string) (*repository.Photo, error) {
	if m.GetErr != nil {
		return nil, m.GetErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.photos[photoID], nil
}

func (m *MockPhotoRepository) ListByGallery(ctx context.Context, galleryID string, limit int, lastKey map[string]interface{}) ([]*repository.Photo, map[string]interface{}, error) {
	if m.ListErr != nil {
		return nil, nil, m.ListErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []*repository.Photo
	for _, p := range m.photos {
		if p.GalleryID == galleryID {
			result = append(result, p)
		}
	}
	return result, nil, nil
}

func (m *MockPhotoRepository) Update(ctx context.Context, photo *repository.Photo) error {
	if m.UpdateErr != nil {
		return m.UpdateErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.photos[photo.PhotoID] = photo
	return nil
}

func (m *MockPhotoRepository) Delete(ctx context.Context, photoID string) error {
	if m.DeleteErr != nil {
		return m.DeleteErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.photos, photoID)
	return nil
}

func (m *MockPhotoRepository) IncrementFavoriteCount(ctx context.Context, photoID string, delta int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if photo := m.photos[photoID]; photo != nil {
		photo.FavoriteCount += delta
	}
	return nil
}

func (m *MockPhotoRepository) IncrementDownloadCount(ctx context.Context, photoID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if photo := m.photos[photoID]; photo != nil {
		photo.DownloadCount++
	}
	return nil
}

// AddPhoto directly adds a photo for test setup.
func (m *MockPhotoRepository) AddPhoto(photo *repository.Photo) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.photos[photo.PhotoID] = photo
}

// MockFavoriteRepository is a mock implementation of FavoriteRepository.
type MockFavoriteRepository struct {
	mu        sync.RWMutex
	favorites map[string]*repository.Favorite // key: galleryID:sessionID:photoID
	CreateErr error
	DeleteErr error
	ListErr   error
}

// NewMockFavoriteRepository creates a new mock favorite repository.
func NewMockFavoriteRepository() *MockFavoriteRepository {
	return &MockFavoriteRepository{
		favorites: make(map[string]*repository.Favorite),
	}
}

func (m *MockFavoriteRepository) key(galleryID, sessionID, photoID string) string {
	return galleryID + ":" + sessionID + ":" + photoID
}

func (m *MockFavoriteRepository) Create(ctx context.Context, favorite *repository.Favorite) error {
	if m.CreateErr != nil {
		return m.CreateErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	key := m.key(favorite.GalleryID, favorite.SessionID, favorite.PhotoID)
	m.favorites[key] = favorite
	return nil
}

func (m *MockFavoriteRepository) Delete(ctx context.Context, galleryID, sessionID, photoID string) error {
	if m.DeleteErr != nil {
		return m.DeleteErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	key := m.key(galleryID, sessionID, photoID)
	delete(m.favorites, key)
	return nil
}

func (m *MockFavoriteRepository) IsFavorited(ctx context.Context, galleryID, sessionID, photoID string) (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	key := m.key(galleryID, sessionID, photoID)
	_, ok := m.favorites[key]
	return ok, nil
}

func (m *MockFavoriteRepository) ListBySession(ctx context.Context, galleryID, sessionID string) ([]*repository.Favorite, error) {
	if m.ListErr != nil {
		return nil, m.ListErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []*repository.Favorite
	for _, f := range m.favorites {
		if f.GalleryID == galleryID && f.SessionID == sessionID {
			result = append(result, f)
		}
	}
	return result, nil
}

func (m *MockFavoriteRepository) ListByGallery(ctx context.Context, galleryID string) ([]*repository.Favorite, error) {
	if m.ListErr != nil {
		return nil, m.ListErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []*repository.Favorite
	for _, f := range m.favorites {
		if f.GalleryID == galleryID {
			result = append(result, f)
		}
	}
	return result, nil
}

// MockClientSessionRepository is a mock implementation of ClientSessionRepository.
type MockClientSessionRepository struct {
	mu        sync.RWMutex
	sessions  map[string]*repository.ClientSession // key: galleryID:sessionID
	CreateErr error
	GetErr    error
	UpdateErr error
	DeleteErr error
}

// NewMockClientSessionRepository creates a new mock client session repository.
func NewMockClientSessionRepository() *MockClientSessionRepository {
	return &MockClientSessionRepository{
		sessions: make(map[string]*repository.ClientSession),
	}
}

func (m *MockClientSessionRepository) key(galleryID, sessionID string) string {
	return galleryID + ":" + sessionID
}

func (m *MockClientSessionRepository) Create(ctx context.Context, session *repository.ClientSession) error {
	if m.CreateErr != nil {
		return m.CreateErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	key := m.key(session.GalleryID, session.SessionID)
	m.sessions[key] = session
	return nil
}

func (m *MockClientSessionRepository) GetByID(ctx context.Context, galleryID, sessionID string) (*repository.ClientSession, error) {
	if m.GetErr != nil {
		return nil, m.GetErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	key := m.key(galleryID, sessionID)
	return m.sessions[key], nil
}

func (m *MockClientSessionRepository) Update(ctx context.Context, session *repository.ClientSession) error {
	if m.UpdateErr != nil {
		return m.UpdateErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	key := m.key(session.GalleryID, session.SessionID)
	m.sessions[key] = session
	return nil
}

func (m *MockClientSessionRepository) Delete(ctx context.Context, galleryID, sessionID string) error {
	if m.DeleteErr != nil {
		return m.DeleteErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	key := m.key(galleryID, sessionID)
	delete(m.sessions, key)
	return nil
}

// MockPhotographerRepository is a mock implementation of PhotographerRepository.
type MockPhotographerRepository struct {
	mu            sync.RWMutex
	photographers map[string]*repository.Photographer
	emailIndex    map[string]*repository.Photographer
	CreateErr     error
	GetErr        error
	UpdateErr     error
	DeleteErr     error
}

// NewMockPhotographerRepository creates a new mock photographer repository.
func NewMockPhotographerRepository() *MockPhotographerRepository {
	return &MockPhotographerRepository{
		photographers: make(map[string]*repository.Photographer),
		emailIndex:    make(map[string]*repository.Photographer),
	}
}

func (m *MockPhotographerRepository) Create(ctx context.Context, photographer *repository.Photographer) error {
	if m.CreateErr != nil {
		return m.CreateErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.photographers[photographer.UserID] = photographer
	m.emailIndex[photographer.Email] = photographer
	return nil
}

func (m *MockPhotographerRepository) GetByID(ctx context.Context, userID string) (*repository.Photographer, error) {
	if m.GetErr != nil {
		return nil, m.GetErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.photographers[userID], nil
}

func (m *MockPhotographerRepository) GetByEmail(ctx context.Context, email string) (*repository.Photographer, error) {
	if m.GetErr != nil {
		return nil, m.GetErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.emailIndex[email], nil
}

func (m *MockPhotographerRepository) Update(ctx context.Context, photographer *repository.Photographer) error {
	if m.UpdateErr != nil {
		return m.UpdateErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.photographers[photographer.UserID] = photographer
	m.emailIndex[photographer.Email] = photographer
	return nil
}

func (m *MockPhotographerRepository) Delete(ctx context.Context, userID string) error {
	if m.DeleteErr != nil {
		return m.DeleteErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if p := m.photographers[userID]; p != nil {
		delete(m.emailIndex, p.Email)
		delete(m.photographers, userID)
	}
	return nil
}

func (m *MockPhotographerRepository) UpdateStorageUsed(ctx context.Context, userID string, deltaBytes int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if p := m.photographers[userID]; p != nil {
		p.StorageUsed += deltaBytes
	}
	return nil
}

// AddPhotographer directly adds a photographer for test setup.
func (m *MockPhotographerRepository) AddPhotographer(photographer *repository.Photographer) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.photographers[photographer.UserID] = photographer
	m.emailIndex[photographer.Email] = photographer
}
