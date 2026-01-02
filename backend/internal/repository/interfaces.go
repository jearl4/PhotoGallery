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
}

// Gallery represents a photo gallery
type Gallery struct {
	GalleryID         string    `dynamodbav:"galleryId" json:"galleryId"`
	PhotographerID    string    `dynamodbav:"photographerId" json:"photographerId"`
	Name              string    `dynamodbav:"name" json:"name"`
	Description       string    `dynamodbav:"description" json:"description"`
	CustomURL         string    `dynamodbav:"customUrl" json:"customUrl"`
	Password          string    `dynamodbav:"password" json:"-"` // bcrypt hash, never expose in JSON
	CreatedAt         time.Time `dynamodbav:"createdAt" json:"createdAt"`
	ExpiresAt         *time.Time `dynamodbav:"expiresAt,omitempty" json:"expiresAt,omitempty"`
	Status            string    `dynamodbav:"status" json:"status"` // active, expired, archived
	PhotoCount        int       `dynamodbav:"photoCount" json:"photoCount"`
	TotalSize         int64     `dynamodbav:"totalSize" json:"totalSize"`
	ClientAccessCount int       `dynamodbav:"clientAccessCount" json:"clientAccessCount"`
	EnableWatermark   bool      `dynamodbav:"enableWatermark" json:"enableWatermark"`
	WatermarkText     string    `dynamodbav:"watermarkText,omitempty" json:"watermarkText,omitempty"`
	WatermarkPosition string    `dynamodbav:"watermarkPosition,omitempty" json:"watermarkPosition,omitempty"` // bottom-right, bottom-left, center
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
}

// PhotographerRepository defines methods for photographer data operations
type PhotographerRepository interface {
	Create(ctx context.Context, photographer *Photographer) error
	GetByID(ctx context.Context, userID string) (*Photographer, error)
	GetByEmail(ctx context.Context, email string) (*Photographer, error)
	Update(ctx context.Context, photographer *Photographer) error
	Delete(ctx context.Context, userID string) error
	UpdateStorageUsed(ctx context.Context, userID string, deltaBytes int64) error
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
}
