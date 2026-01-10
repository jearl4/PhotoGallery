// Package fixtures provides factory functions for creating test data.
package fixtures

import (
	"fmt"
	"sync/atomic"
	"time"

	"photographer-gallery/backend/internal/repository"
)

var idCounter int64

// ResetIDCounter resets the ID counter (call in test setup for isolation).
func ResetIDCounter() {
	atomic.StoreInt64(&idCounter, 0)
}

// GenerateID generates a unique ID with the given prefix.
func GenerateID(prefix string) string {
	id := atomic.AddInt64(&idCounter, 1)
	return fmt.Sprintf("%s_%d", prefix, id)
}

// ============= Photographer Fixtures =============

// PhotographerOptions allows customizing photographer creation.
type PhotographerOptions struct {
	UserID      string
	Email       string
	Name        string
	Provider    string
	StorageUsed int64
	Plan        string
}

// NewPhotographer creates a new photographer with sensible defaults.
func NewPhotographer(opts ...PhotographerOptions) *repository.Photographer {
	opt := PhotographerOptions{}
	if len(opts) > 0 {
		opt = opts[0]
	}

	userID := opt.UserID
	if userID == "" {
		userID = GenerateID("user")
	}

	email := opt.Email
	if email == "" {
		email = fmt.Sprintf("photographer%d@example.com", atomic.LoadInt64(&idCounter))
	}

	name := opt.Name
	if name == "" {
		name = fmt.Sprintf("Test Photographer %d", atomic.LoadInt64(&idCounter))
	}

	provider := opt.Provider
	if provider == "" {
		provider = "google"
	}

	plan := opt.Plan
	if plan == "" {
		plan = "free"
	}

	now := time.Now()
	return &repository.Photographer{
		UserID:      userID,
		Email:       email,
		Name:        name,
		Provider:    provider,
		StorageUsed: opt.StorageUsed,
		Plan:        plan,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// ============= Gallery Fixtures =============

// GalleryOptions allows customizing gallery creation.
type GalleryOptions struct {
	GalleryID         string
	PhotographerID    string
	Name              string
	Description       string
	CustomURL         string
	Password          string
	ExpiresAt         *time.Time
	Status            string
	PhotoCount        int
	TotalSize         int64
	ClientAccessCount int
	EnableWatermark   bool
	WatermarkText     string
	WatermarkPosition string
}

// NewGallery creates a new gallery with sensible defaults.
func NewGallery(opts ...GalleryOptions) *repository.Gallery {
	opt := GalleryOptions{}
	if len(opts) > 0 {
		opt = opts[0]
	}

	galleryID := opt.GalleryID
	if galleryID == "" {
		galleryID = GenerateID("gal")
	}

	photographerID := opt.PhotographerID
	if photographerID == "" {
		photographerID = GenerateID("user")
	}

	name := opt.Name
	if name == "" {
		name = fmt.Sprintf("Test Gallery %d", atomic.LoadInt64(&idCounter))
	}

	customURL := opt.CustomURL
	if customURL == "" {
		customURL = fmt.Sprintf("gallery-%d", atomic.LoadInt64(&idCounter))
	}

	password := opt.Password
	if password == "" {
		password = "$2a$10$hashedPasswordPlaceholder" // bcrypt hash placeholder
	}

	status := opt.Status
	if status == "" {
		status = "active"
	}

	return &repository.Gallery{
		GalleryID:         galleryID,
		PhotographerID:    photographerID,
		Name:              name,
		Description:       opt.Description,
		CustomURL:         customURL,
		Password:          password,
		CreatedAt:         time.Now(),
		ExpiresAt:         opt.ExpiresAt,
		Status:            status,
		PhotoCount:        opt.PhotoCount,
		TotalSize:         opt.TotalSize,
		ClientAccessCount: opt.ClientAccessCount,
		EnableWatermark:   opt.EnableWatermark,
		WatermarkText:     opt.WatermarkText,
		WatermarkPosition: opt.WatermarkPosition,
	}
}

// NewExpiredGallery creates an expired gallery.
func NewExpiredGallery(opts ...GalleryOptions) *repository.Gallery {
	expiredTime := time.Now().Add(-24 * time.Hour)
	opt := GalleryOptions{}
	if len(opts) > 0 {
		opt = opts[0]
	}
	opt.ExpiresAt = &expiredTime
	opt.Status = "expired"
	return NewGallery(opt)
}

// NewExpiringGallery creates a gallery that expires in the given duration.
func NewExpiringGallery(duration time.Duration, opts ...GalleryOptions) *repository.Gallery {
	expiresAt := time.Now().Add(duration)
	opt := GalleryOptions{}
	if len(opts) > 0 {
		opt = opts[0]
	}
	opt.ExpiresAt = &expiresAt
	return NewGallery(opt)
}

// NewGalleryList creates multiple galleries.
func NewGalleryList(count int, photographerID string) []*repository.Gallery {
	galleries := make([]*repository.Gallery, count)
	for i := 0; i < count; i++ {
		galleries[i] = NewGallery(GalleryOptions{
			PhotographerID: photographerID,
		})
	}
	return galleries
}

// ============= Photo Fixtures =============

// PhotoOptions allows customizing photo creation.
type PhotoOptions struct {
	PhotoID          string
	GalleryID        string
	FileName         string
	OriginalKey      string
	OptimizedKey     string
	ThumbnailKey     string
	MimeType         string
	Size             int64
	Width            int
	Height           int
	ProcessingStatus string
	FavoriteCount    int
	DownloadCount    int
	Metadata         map[string]string
}

// NewPhoto creates a new photo with sensible defaults.
func NewPhoto(opts ...PhotoOptions) *repository.Photo {
	opt := PhotoOptions{}
	if len(opts) > 0 {
		opt = opts[0]
	}

	photoID := opt.PhotoID
	if photoID == "" {
		photoID = GenerateID("photo")
	}

	galleryID := opt.GalleryID
	if galleryID == "" {
		galleryID = GenerateID("gal")
	}

	fileName := opt.FileName
	if fileName == "" {
		fileName = fmt.Sprintf("image_%d.jpg", atomic.LoadInt64(&idCounter))
	}

	originalKey := opt.OriginalKey
	if originalKey == "" {
		originalKey = fmt.Sprintf("%s/%s/original/%s", galleryID, photoID, fileName)
	}

	optimizedKey := opt.OptimizedKey
	if optimizedKey == "" {
		optimizedKey = fmt.Sprintf("%s/%s/optimized/%s", galleryID, photoID, fileName)
	}

	thumbnailKey := opt.ThumbnailKey
	if thumbnailKey == "" {
		thumbnailKey = fmt.Sprintf("%s/%s/thumbnail/%s", galleryID, photoID, fileName)
	}

	mimeType := opt.MimeType
	if mimeType == "" {
		mimeType = "image/jpeg"
	}

	size := opt.Size
	if size == 0 {
		size = 1024 * 1024 // 1MB default
	}

	width := opt.Width
	if width == 0 {
		width = 1920
	}

	height := opt.Height
	if height == 0 {
		height = 1080
	}

	status := opt.ProcessingStatus
	if status == "" {
		status = "completed"
	}

	now := time.Now()
	return &repository.Photo{
		PhotoID:          photoID,
		GalleryID:        galleryID,
		FileName:         fileName,
		OriginalKey:      originalKey,
		OptimizedKey:     optimizedKey,
		ThumbnailKey:     thumbnailKey,
		MimeType:         mimeType,
		Size:             size,
		Width:            width,
		Height:           height,
		ProcessingStatus: status,
		UploadedAt:       now,
		ProcessedAt:      &now,
		FavoriteCount:    opt.FavoriteCount,
		DownloadCount:    opt.DownloadCount,
		Metadata:         opt.Metadata,
	}
}

// NewPendingPhoto creates a photo with pending processing status.
func NewPendingPhoto(opts ...PhotoOptions) *repository.Photo {
	opt := PhotoOptions{}
	if len(opts) > 0 {
		opt = opts[0]
	}
	opt.ProcessingStatus = "pending"
	opt.OptimizedKey = ""
	opt.ThumbnailKey = ""
	photo := NewPhoto(opt)
	photo.ProcessedAt = nil
	return photo
}

// NewPhotoList creates multiple photos for a gallery.
func NewPhotoList(count int, galleryID string) []*repository.Photo {
	photos := make([]*repository.Photo, count)
	for i := 0; i < count; i++ {
		photos[i] = NewPhoto(PhotoOptions{GalleryID: galleryID})
	}
	return photos
}

// ============= Favorite Fixtures =============

// FavoriteOptions allows customizing favorite creation.
type FavoriteOptions struct {
	GalleryID string
	SessionID string
	PhotoID   string
}

// NewFavorite creates a new favorite with sensible defaults.
func NewFavorite(opts ...FavoriteOptions) *repository.Favorite {
	opt := FavoriteOptions{}
	if len(opts) > 0 {
		opt = opts[0]
	}

	galleryID := opt.GalleryID
	if galleryID == "" {
		galleryID = GenerateID("gal")
	}

	sessionID := opt.SessionID
	if sessionID == "" {
		sessionID = GenerateID("session")
	}

	photoID := opt.PhotoID
	if photoID == "" {
		photoID = GenerateID("photo")
	}

	return &repository.Favorite{
		GalleryID:   galleryID,
		SessionID:   sessionID,
		PhotoID:     photoID,
		FavoritedAt: time.Now(),
	}
}

// NewFavoriteList creates favorites for multiple photos.
func NewFavoriteList(galleryID, sessionID string, photoIDs []string) []*repository.Favorite {
	favorites := make([]*repository.Favorite, len(photoIDs))
	for i, photoID := range photoIDs {
		favorites[i] = NewFavorite(FavoriteOptions{
			GalleryID: galleryID,
			SessionID: sessionID,
			PhotoID:   photoID,
		})
	}
	return favorites
}

// ============= Client Session Fixtures =============

// ClientSessionOptions allows customizing client session creation.
type ClientSessionOptions struct {
	SessionID   string
	GalleryID   string
	IPHash      string
	UserAgent   string
	AccessCount int
}

// NewClientSession creates a new client session with sensible defaults.
func NewClientSession(opts ...ClientSessionOptions) *repository.ClientSession {
	opt := ClientSessionOptions{}
	if len(opts) > 0 {
		opt = opts[0]
	}

	sessionID := opt.SessionID
	if sessionID == "" {
		sessionID = GenerateID("session")
	}

	galleryID := opt.GalleryID
	if galleryID == "" {
		galleryID = GenerateID("gal")
	}

	ipHash := opt.IPHash
	if ipHash == "" {
		ipHash = "hashed_ip_placeholder"
	}

	userAgent := opt.UserAgent
	if userAgent == "" {
		userAgent = "TestBrowser/1.0"
	}

	accessCount := opt.AccessCount
	if accessCount == 0 {
		accessCount = 1
	}

	now := time.Now()
	return &repository.ClientSession{
		SessionID:     sessionID,
		GalleryID:     galleryID,
		IPAddressHash: ipHash,
		UserAgent:     userAgent,
		FirstAccessAt: now,
		LastAccessAt:  now,
		AccessCount:   accessCount,
		TTL:           now.Add(24 * time.Hour).Unix(),
	}
}
