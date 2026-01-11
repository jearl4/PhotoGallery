package repository

import (
	"context"
	"time"
)

// Photographer represents a photographer user
type Photographer struct {
	UserID      string    `dynamodbav:"userId" json:"userId"`
	Email       string    `dynamodbav:"email" json:"email"`
	Name        string    `dynamodbav:"name" json:"name"`
	Provider    string    `dynamodbav:"provider" json:"provider"` // google, facebook, apple
	StorageUsed int64     `dynamodbav:"storageUsed" json:"storageUsed"`
	Plan        string    `dynamodbav:"plan" json:"plan"` // free, pro
	CreatedAt   time.Time `dynamodbav:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time `dynamodbav:"updatedAt" json:"updatedAt"`

	// Analytics aggregates
	TotalViews      int64 `dynamodbav:"totalViews" json:"totalViews"`
	TotalDownloads  int64 `dynamodbav:"totalDownloads" json:"totalDownloads"`
	TotalFavorites  int64 `dynamodbav:"totalFavorites" json:"totalFavorites"`
	TotalGalleries  int   `dynamodbav:"totalGalleries" json:"totalGalleries"`
	TotalPhotos     int   `dynamodbav:"totalPhotos" json:"totalPhotos"`
	TotalClients    int64 `dynamodbav:"totalClients" json:"totalClients"`
	ActiveGalleries int   `dynamodbav:"activeGalleries" json:"activeGalleries"`
}

// Gallery represents a photo gallery
type Gallery struct {
	GalleryID         string     `dynamodbav:"galleryId" json:"galleryId"`
	PhotographerID    string     `dynamodbav:"photographerId" json:"photographerId"`
	Name              string     `dynamodbav:"name" json:"name"`
	Description       string     `dynamodbav:"description" json:"description"`
	CustomURL         string     `dynamodbav:"customUrl" json:"customUrl"`
	Password          string     `dynamodbav:"password" json:"-"` // bcrypt hash, never expose in JSON
	CreatedAt         time.Time  `dynamodbav:"createdAt" json:"createdAt"`
	ExpiresAt         *time.Time `dynamodbav:"expiresAt,omitempty" json:"expiresAt,omitempty"`
	Status            string     `dynamodbav:"status" json:"status"` // active, expired, archived
	PhotoCount        int        `dynamodbav:"photoCount" json:"photoCount"`
	TotalSize         int64      `dynamodbav:"totalSize" json:"totalSize"`
	ClientAccessCount int        `dynamodbav:"clientAccessCount" json:"clientAccessCount"`
	EnableWatermark   bool       `dynamodbav:"enableWatermark" json:"enableWatermark"`
	WatermarkText     string     `dynamodbav:"watermarkText,omitempty" json:"watermarkText,omitempty"`
	WatermarkPosition string     `dynamodbav:"watermarkPosition,omitempty" json:"watermarkPosition,omitempty"` // bottom-right, bottom-left, center

	// Analytics
	ViewCount          int64      `dynamodbav:"viewCount" json:"viewCount"`
	TotalDownloads     int64      `dynamodbav:"totalDownloads" json:"totalDownloads"`
	TotalFavorites     int64      `dynamodbav:"totalFavorites" json:"totalFavorites"`
	UniqueClients      int64      `dynamodbav:"uniqueClients" json:"uniqueClients"`
	LastClientAccessAt *time.Time `dynamodbav:"lastClientAccessAt,omitempty" json:"lastClientAccessAt,omitempty"`
}

// Photo represents a photo in a gallery
type Photo struct {
	PhotoID          string            `dynamodbav:"photoId" json:"photoId"`
	GalleryID        string            `dynamodbav:"galleryId" json:"galleryId"`
	FileName         string            `dynamodbav:"fileName" json:"fileName"`
	OriginalKey      string            `dynamodbav:"originalKey" json:"originalKey"`
	OptimizedKey     string            `dynamodbav:"optimizedKey,omitempty" json:"optimizedKey,omitempty"`
	ThumbnailKey     string            `dynamodbav:"thumbnailKey,omitempty" json:"thumbnailKey,omitempty"`
	MimeType         string            `dynamodbav:"mimeType" json:"mimeType"`
	Size             int64             `dynamodbav:"size" json:"size"`
	Width            int               `dynamodbav:"width,omitempty" json:"width,omitempty"`
	Height           int               `dynamodbav:"height,omitempty" json:"height,omitempty"`
	ProcessingStatus string            `dynamodbav:"processingStatus" json:"processingStatus"` // pending, processing, completed, failed
	UploadedAt       time.Time         `dynamodbav:"uploadedAt" json:"uploadedAt"`
	ProcessedAt      *time.Time        `dynamodbav:"processedAt,omitempty" json:"processedAt,omitempty"`
	FavoriteCount    int               `dynamodbav:"favoriteCount" json:"favoriteCount"`
	DownloadCount    int               `dynamodbav:"downloadCount" json:"downloadCount"`
	Metadata         map[string]string `dynamodbav:"metadata,omitempty" json:"metadata,omitempty"` // EXIF data
}

// Favorite represents a client's favorite photo
type Favorite struct {
	GalleryID   string    `dynamodbav:"galleryId" json:"galleryId"`
	SessionID   string    `dynamodbav:"sessionId" json:"sessionId"`
	PhotoID     string    `dynamodbav:"photoId" json:"photoId"`
	FavoritedAt time.Time `dynamodbav:"favoritedAt" json:"favoritedAt"`
}

// ClientSession represents a client's session for gallery access
type ClientSession struct {
	SessionID     string    `dynamodbav:"sessionId" json:"sessionId"`
	GalleryID     string    `dynamodbav:"galleryId" json:"galleryId"`
	IPAddressHash string    `dynamodbav:"ipAddressHash" json:"-"`
	UserAgent     string    `dynamodbav:"userAgent" json:"userAgent"`
	FirstAccessAt time.Time `dynamodbav:"firstAccessAt" json:"firstAccessAt"`
	LastAccessAt  time.Time `dynamodbav:"lastAccessAt" json:"lastAccessAt"`
	AccessCount   int       `dynamodbav:"accessCount" json:"accessCount"`
	TTL           int64     `dynamodbav:"ttl" json:"-"` // Unix timestamp for DynamoDB TTL

	// Device/browser analytics
	DeviceType    string `dynamodbav:"deviceType,omitempty" json:"deviceType,omitempty"`       // mobile, tablet, desktop
	BrowserFamily string `dynamodbav:"browserFamily,omitempty" json:"browserFamily,omitempty"` // chrome, safari, firefox
	OSFamily      string `dynamodbav:"osFamily,omitempty" json:"osFamily,omitempty"`           // iOS, Android, Windows, macOS
}

// PhotographerRepository defines methods for photographer data operations
type PhotographerRepository interface {
	Create(ctx context.Context, photographer *Photographer) error
	GetByID(ctx context.Context, userID string) (*Photographer, error)
	GetByEmail(ctx context.Context, email string) (*Photographer, error)
	Update(ctx context.Context, photographer *Photographer) error
	Delete(ctx context.Context, userID string) error
	UpdateStorageUsed(ctx context.Context, userID string, deltaBytes int64) error

	// Analytics methods
	IncrementTotalViews(ctx context.Context, userID string, delta int64) error
	IncrementTotalDownloads(ctx context.Context, userID string, delta int64) error
	IncrementTotalFavorites(ctx context.Context, userID string, delta int) error
	IncrementTotalGalleries(ctx context.Context, userID string, delta int) error
	IncrementTotalPhotos(ctx context.Context, userID string, delta int) error
	IncrementTotalClients(ctx context.Context, userID string, delta int64) error
	IncrementActiveGalleries(ctx context.Context, userID string, delta int) error
}

// GalleryRepository defines methods for gallery data operations
type GalleryRepository interface {
	Create(ctx context.Context, gallery *Gallery) error
	GetByID(ctx context.Context, galleryID string) (*Gallery, error)
	GetByCustomURL(ctx context.Context, customURL string) (*Gallery, error)
	ListByPhotographer(ctx context.Context, photographerID string, limit int, lastEvaluatedKey map[string]interface{}) ([]*Gallery, map[string]interface{}, error)
	Update(ctx context.Context, gallery *Gallery) error
	Delete(ctx context.Context, galleryID string) error
	ListExpired(ctx context.Context, limit int) ([]*Gallery, error)
	UpdatePhotoCount(ctx context.Context, galleryID string, delta int) error
	UpdateTotalSize(ctx context.Context, galleryID string, deltaBytes int64) error
	IncrementClientAccessCount(ctx context.Context, galleryID string) error

	// Analytics methods
	IncrementViewCount(ctx context.Context, galleryID string, delta int64) error
	IncrementDownloadCount(ctx context.Context, galleryID string, delta int64) error
	IncrementFavoriteCount(ctx context.Context, galleryID string, delta int) error
	IncrementUniqueClients(ctx context.Context, galleryID string) error
	UpdateLastClientAccess(ctx context.Context, galleryID string) error
}

// PhotoRepository defines methods for photo data operations
type PhotoRepository interface {
	Create(ctx context.Context, photo *Photo) error
	GetByID(ctx context.Context, photoID string) (*Photo, error)
	ListByGallery(ctx context.Context, galleryID string, limit int, lastEvaluatedKey map[string]interface{}) ([]*Photo, map[string]interface{}, error)
	Update(ctx context.Context, photo *Photo) error
	Delete(ctx context.Context, photoID string) error
	IncrementFavoriteCount(ctx context.Context, photoID string, delta int) error
	IncrementDownloadCount(ctx context.Context, photoID string) error
}

// FavoriteRepository defines methods for favorite data operations
type FavoriteRepository interface {
	Create(ctx context.Context, favorite *Favorite) error
	Delete(ctx context.Context, galleryID, sessionID, photoID string) error
	IsFavorited(ctx context.Context, galleryID, sessionID, photoID string) (bool, error)
	ListBySession(ctx context.Context, galleryID, sessionID string) ([]*Favorite, error)
	ListByGallery(ctx context.Context, galleryID string) ([]*Favorite, error)
}

// ClientSessionRepository defines methods for client session operations
type ClientSessionRepository interface {
	Create(ctx context.Context, session *ClientSession) error
	GetByID(ctx context.Context, galleryID, sessionID string) (*ClientSession, error)
	Update(ctx context.Context, session *ClientSession) error
	Delete(ctx context.Context, galleryID, sessionID string) error

	// Analytics methods
	ListByGallery(ctx context.Context, galleryID string, limit int) ([]*ClientSession, error)
	CountByGallery(ctx context.Context, galleryID string) (int64, error)
	ListByPhotographerGalleries(ctx context.Context, galleryIDs []string, limit int) ([]*ClientSession, error)
	GetDeviceDistribution(ctx context.Context, galleryIDs []string) (map[string]int64, error)
	GetBrowserDistribution(ctx context.Context, galleryIDs []string) (map[string]int64, error)
}
