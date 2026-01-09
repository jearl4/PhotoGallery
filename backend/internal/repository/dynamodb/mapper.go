// Package dynamodb provides DynamoDB repository implementations.
package dynamodb

import (
	"time"

	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"photographer-gallery/backend/internal/repository"
)

// Mapper provides generic adapter interface for DynamoDB items.
type Mapper[T any] interface {
	ToDynamoDB(entity *T) (map[string]types.AttributeValue, error)
	FromDynamoDB(attrs map[string]types.AttributeValue) (*T, error)
}

// GalleryMapper adapts between the domain Gallery model and DynamoDB representation.
type GalleryMapper struct{}

// NewGalleryMapper creates a new GalleryMapper.
func NewGalleryMapper() *GalleryMapper {
	return &GalleryMapper{}
}

// FromItem converts a galleryItem to a domain Gallery.
func (m *GalleryMapper) FromItem(item *galleryItem) (*repository.Gallery, error) {
	createdAt, err := time.Parse(time.RFC3339, item.CreatedAt)
	if err != nil {
		// Fallback for other formats
		createdAt, _ = time.Parse("2006-01-02T15:04:05Z07:00", item.CreatedAt)
	}

	gallery := &repository.Gallery{
		GalleryID:         item.GalleryID,
		PhotographerID:    item.PhotographerID,
		Name:              item.Name,
		Description:       item.Description,
		CustomURL:         item.CustomURL,
		Password:          item.Password,
		CreatedAt:         createdAt,
		Status:            item.Status,
		PhotoCount:        item.PhotoCount,
		TotalSize:         item.TotalSize,
		ClientAccessCount: item.ClientAccessCount,
		EnableWatermark:   item.EnableWatermark,
		WatermarkText:     item.WatermarkText,
		WatermarkPosition: item.WatermarkPosition,
	}

	if item.ExpiresAt != nil && *item.ExpiresAt != "" {
		expiresAt, err := time.Parse(time.RFC3339, *item.ExpiresAt)
		if err != nil {
			expiresAt, _ = time.Parse("2006-01-02T15:04:05Z07:00", *item.ExpiresAt)
		}
		gallery.ExpiresAt = &expiresAt
	}

	return gallery, nil
}

// FromDynamoDB converts a DynamoDB item map to a domain Gallery.
func (m *GalleryMapper) FromDynamoDB(attrs map[string]types.AttributeValue) (*repository.Gallery, error) {
	var item galleryItem
	if err := attributevalue.UnmarshalMap(attrs, &item); err != nil {
		return nil, err
	}
	return m.FromItem(&item)
}

// ToItem converts a domain Gallery to a galleryItem.
func (m *GalleryMapper) ToItem(gallery *repository.Gallery, pk, sk string) *galleryItem {
	item := &galleryItem{
		PK:                pk,
		SK:                sk,
		GalleryID:         gallery.GalleryID,
		PhotographerID:    gallery.PhotographerID,
		Name:              gallery.Name,
		Description:       gallery.Description,
		CustomURL:         gallery.CustomURL,
		Password:          gallery.Password,
		CreatedAt:         gallery.CreatedAt.Format(time.RFC3339),
		Status:            gallery.Status,
		PhotoCount:        gallery.PhotoCount,
		TotalSize:         gallery.TotalSize,
		ClientAccessCount: gallery.ClientAccessCount,
		EnableWatermark:   gallery.EnableWatermark,
		WatermarkText:     gallery.WatermarkText,
		WatermarkPosition: gallery.WatermarkPosition,
	}

	if gallery.ExpiresAt != nil {
		expiresAtStr := gallery.ExpiresAt.Format(time.RFC3339)
		item.ExpiresAt = &expiresAtStr
	}

	return item
}

// PhotoMapper adapts between the domain Photo model and DynamoDB representation.
type PhotoMapper struct{}

// NewPhotoMapper creates a new PhotoMapper.
func NewPhotoMapper() *PhotoMapper {
	return &PhotoMapper{}
}

// FromItem converts a photoItem to a domain Photo.
func (m *PhotoMapper) FromItem(item *photoItem) (*repository.Photo, error) {
	uploadedAt, err := time.Parse(time.RFC3339, item.UploadedAt)
	if err != nil {
		uploadedAt, _ = time.Parse("2006-01-02T15:04:05Z07:00", item.UploadedAt)
	}

	photo := &repository.Photo{
		PhotoID:          item.PhotoID,
		GalleryID:        item.GalleryID,
		FileName:         item.FileName,
		OriginalKey:      item.OriginalKey,
		OptimizedKey:     item.OptimizedKey,
		ThumbnailKey:     item.ThumbnailKey,
		MimeType:         item.MimeType,
		Size:             item.Size,
		Width:            item.Width,
		Height:           item.Height,
		ProcessingStatus: item.ProcessingStatus,
		UploadedAt:       uploadedAt,
		FavoriteCount:    item.FavoriteCount,
		DownloadCount:    item.DownloadCount,
		Metadata:         item.Metadata,
	}

	if item.ProcessedAt != "" {
		processedAt, err := time.Parse(time.RFC3339, item.ProcessedAt)
		if err != nil {
			processedAt, _ = time.Parse("2006-01-02T15:04:05Z07:00", item.ProcessedAt)
		}
		photo.ProcessedAt = &processedAt
	}

	return photo, nil
}

// FromDynamoDB converts a DynamoDB item map to a domain Photo.
func (m *PhotoMapper) FromDynamoDB(attrs map[string]types.AttributeValue) (*repository.Photo, error) {
	var item photoItem
	if err := attributevalue.UnmarshalMap(attrs, &item); err != nil {
		return nil, err
	}
	return m.FromItem(&item)
}

// ToItem converts a domain Photo to a photoItem.
func (m *PhotoMapper) ToItem(photo *repository.Photo, pk, sk string) *photoItem {
	item := &photoItem{
		PK:               pk,
		SK:               sk,
		PhotoID:          photo.PhotoID,
		GalleryID:        photo.GalleryID,
		FileName:         photo.FileName,
		OriginalKey:      photo.OriginalKey,
		OptimizedKey:     photo.OptimizedKey,
		ThumbnailKey:     photo.ThumbnailKey,
		MimeType:         photo.MimeType,
		Size:             photo.Size,
		Width:            photo.Width,
		Height:           photo.Height,
		ProcessingStatus: photo.ProcessingStatus,
		UploadedAt:       photo.UploadedAt.Format(time.RFC3339),
		FavoriteCount:    photo.FavoriteCount,
		DownloadCount:    photo.DownloadCount,
		Metadata:         photo.Metadata,
	}

	if photo.ProcessedAt != nil {
		item.ProcessedAt = photo.ProcessedAt.Format(time.RFC3339)
	}

	return item
}

// SessionMapper adapts between the domain ClientSession and DynamoDB representation.
type SessionMapper struct{}

// NewSessionMapper creates a new SessionMapper.
func NewSessionMapper() *SessionMapper {
	return &SessionMapper{}
}

// FromItem converts a sessionItem to a domain ClientSession.
func (m *SessionMapper) FromItem(item *sessionItem) (*repository.ClientSession, error) {
	firstAccessAt, err := time.Parse(time.RFC3339, item.FirstAccessAt)
	if err != nil {
		firstAccessAt, _ = time.Parse("2006-01-02T15:04:05Z07:00", item.FirstAccessAt)
	}

	lastAccessAt, err := time.Parse(time.RFC3339, item.LastAccessAt)
	if err != nil {
		lastAccessAt, _ = time.Parse("2006-01-02T15:04:05Z07:00", item.LastAccessAt)
	}

	return &repository.ClientSession{
		SessionID:     item.SessionID,
		GalleryID:     item.GalleryID,
		IPAddressHash: item.IPAddressHash,
		UserAgent:     item.UserAgent,
		FirstAccessAt: firstAccessAt,
		LastAccessAt:  lastAccessAt,
		AccessCount:   item.AccessCount,
		TTL:           item.TTL,
	}, nil
}

// FromDynamoDB converts a DynamoDB item map to a domain ClientSession.
func (m *SessionMapper) FromDynamoDB(attrs map[string]types.AttributeValue) (*repository.ClientSession, error) {
	var item sessionItem
	if err := attributevalue.UnmarshalMap(attrs, &item); err != nil {
		return nil, err
	}
	return m.FromItem(&item)
}

// ToItem converts a domain ClientSession to a sessionItem.
func (m *SessionMapper) ToItem(session *repository.ClientSession, pk, sk string) *sessionItem {
	return &sessionItem{
		PK:            pk,
		SK:            sk,
		SessionID:     session.SessionID,
		GalleryID:     session.GalleryID,
		IPAddressHash: session.IPAddressHash,
		UserAgent:     session.UserAgent,
		FirstAccessAt: session.FirstAccessAt.Format(time.RFC3339),
		LastAccessAt:  session.LastAccessAt.Format(time.RFC3339),
		AccessCount:   session.AccessCount,
		TTL:           session.TTL,
	}
}
