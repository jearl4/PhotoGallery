package dynamodb

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"photographer-gallery/backend/internal/repository"
)

type ClientSessionRepository struct {
	client    *dynamodb.Client
	tableName string
}

func NewClientSessionRepository(client *dynamodb.Client, tableName string) *ClientSessionRepository {
	return &ClientSessionRepository{
		client:    client,
		tableName: tableName,
	}
}

type sessionItem struct {
	PK            string `dynamodbav:"PK"`
	SK            string `dynamodbav:"SK"`
	SessionID     string `dynamodbav:"sessionId"`
	GalleryID     string `dynamodbav:"galleryId"`
	IPAddressHash string `dynamodbav:"ipAddressHash"`
	UserAgent     string `dynamodbav:"userAgent"`
	FirstAccessAt string `dynamodbav:"firstAccessAt"`
	LastAccessAt  string `dynamodbav:"lastAccessAt"`
	AccessCount   int    `dynamodbav:"accessCount"`
	TTL           int64  `dynamodbav:"ttl"`

	// Device/browser analytics
	DeviceType    string `dynamodbav:"deviceType,omitempty"`
	BrowserFamily string `dynamodbav:"browserFamily,omitempty"`
	OSFamily      string `dynamodbav:"osFamily,omitempty"`
}

func (r *ClientSessionRepository) Create(ctx context.Context, session *repository.ClientSession) error {
	item := sessionItem{
		PK:            fmt.Sprintf("GALLERY#%s", session.GalleryID),
		SK:            fmt.Sprintf("SESSION#%s", session.SessionID),
		SessionID:     session.SessionID,
		GalleryID:     session.GalleryID,
		IPAddressHash: session.IPAddressHash,
		UserAgent:     session.UserAgent,
		FirstAccessAt: session.FirstAccessAt.Format("2006-01-02T15:04:05Z07:00"),
		LastAccessAt:  session.LastAccessAt.Format("2006-01-02T15:04:05Z07:00"),
		AccessCount:   session.AccessCount,
		TTL:           session.TTL,
	}

	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("failed to marshal session: %w", err)
	}

	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      av,
	})

	return err
}

func (r *ClientSessionRepository) GetByID(ctx context.Context, galleryID, sessionID string) (*repository.ClientSession, error) {
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s", galleryID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("SESSION#%s", sessionID)},
		},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	if result.Item == nil {
		return nil, nil
	}

	var item sessionItem
	if err := attributevalue.UnmarshalMap(result.Item, &item); err != nil {
		return nil, fmt.Errorf("failed to unmarshal session: %w", err)
	}

	return itemToSession(&item), nil
}

func (r *ClientSessionRepository) Update(ctx context.Context, session *repository.ClientSession) error {
	item := sessionItem{
		PK:            fmt.Sprintf("GALLERY#%s", session.GalleryID),
		SK:            fmt.Sprintf("SESSION#%s", session.SessionID),
		SessionID:     session.SessionID,
		GalleryID:     session.GalleryID,
		IPAddressHash: session.IPAddressHash,
		UserAgent:     session.UserAgent,
		FirstAccessAt: session.FirstAccessAt.Format("2006-01-02T15:04:05Z07:00"),
		LastAccessAt:  session.LastAccessAt.Format("2006-01-02T15:04:05Z07:00"),
		AccessCount:   session.AccessCount,
		TTL:           session.TTL,
	}

	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("failed to marshal session: %w", err)
	}

	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      av,
	})

	return err
}

func (r *ClientSessionRepository) Delete(ctx context.Context, galleryID, sessionID string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s", galleryID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("SESSION#%s", sessionID)},
		},
	})

	return err
}

func itemToSession(item *sessionItem) *repository.ClientSession {
	session := &repository.ClientSession{
		SessionID:     item.SessionID,
		GalleryID:     item.GalleryID,
		IPAddressHash: item.IPAddressHash,
		UserAgent:     item.UserAgent,
		AccessCount:   item.AccessCount,
		TTL:           item.TTL,
		DeviceType:    item.DeviceType,
		BrowserFamily: item.BrowserFamily,
		OSFamily:      item.OSFamily,
	}

	// Parse timestamps
	if item.FirstAccessAt != "" {
		if t, err := time.Parse("2006-01-02T15:04:05Z07:00", item.FirstAccessAt); err == nil {
			session.FirstAccessAt = t
		}
	}
	if item.LastAccessAt != "" {
		if t, err := time.Parse("2006-01-02T15:04:05Z07:00", item.LastAccessAt); err == nil {
			session.LastAccessAt = t
		}
	}

	return session
}

// Analytics methods

// ListByGallery lists all sessions for a gallery
func (r *ClientSessionRepository) ListByGallery(ctx context.Context, galleryID string, limit int) ([]*repository.ClientSession, error) {
	input := &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :sk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s", galleryID)},
			":sk": &types.AttributeValueMemberS{Value: "SESSION#"},
		},
		Limit: aws.Int32(int32(limit)),
	}

	result, err := r.client.Query(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to list sessions by gallery: %w", err)
	}

	sessions := make([]*repository.ClientSession, 0, len(result.Items))
	for _, item := range result.Items {
		var sessionItem sessionItem
		if err := attributevalue.UnmarshalMap(item, &sessionItem); err != nil {
			return nil, fmt.Errorf("failed to unmarshal session: %w", err)
		}
		sessions = append(sessions, itemToSession(&sessionItem))
	}

	return sessions, nil
}

// CountByGallery counts all sessions for a gallery
func (r *ClientSessionRepository) CountByGallery(ctx context.Context, galleryID string) (int64, error) {
	input := &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :sk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s", galleryID)},
			":sk": &types.AttributeValueMemberS{Value: "SESSION#"},
		},
		Select: types.SelectCount,
	}

	result, err := r.client.Query(ctx, input)
	if err != nil {
		return 0, fmt.Errorf("failed to count sessions by gallery: %w", err)
	}

	return int64(result.Count), nil
}

// ListByPhotographerGalleries lists sessions for multiple galleries
func (r *ClientSessionRepository) ListByPhotographerGalleries(ctx context.Context, galleryIDs []string, limit int) ([]*repository.ClientSession, error) {
	if len(galleryIDs) == 0 {
		return []*repository.ClientSession{}, nil
	}

	sessions := make([]*repository.ClientSession, 0)
	limitPerGallery := limit / len(galleryIDs)
	if limitPerGallery < 10 {
		limitPerGallery = 10
	}

	for _, galleryID := range galleryIDs {
		gallerySessions, err := r.ListByGallery(ctx, galleryID, limitPerGallery)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, gallerySessions...)
		if len(sessions) >= limit {
			break
		}
	}

	if len(sessions) > limit {
		sessions = sessions[:limit]
	}

	return sessions, nil
}

// GetDeviceDistribution returns device type distribution for sessions
func (r *ClientSessionRepository) GetDeviceDistribution(ctx context.Context, galleryIDs []string) (map[string]int64, error) {
	distribution := map[string]int64{
		"mobile":  0,
		"tablet":  0,
		"desktop": 0,
	}

	sessions, err := r.ListByPhotographerGalleries(ctx, galleryIDs, 1000)
	if err != nil {
		return nil, err
	}

	for _, session := range sessions {
		if session.DeviceType != "" {
			distribution[session.DeviceType]++
		} else {
			distribution["desktop"]++ // Default to desktop if not set
		}
	}

	return distribution, nil
}

// GetBrowserDistribution returns browser distribution for sessions
func (r *ClientSessionRepository) GetBrowserDistribution(ctx context.Context, galleryIDs []string) (map[string]int64, error) {
	distribution := make(map[string]int64)

	sessions, err := r.ListByPhotographerGalleries(ctx, galleryIDs, 1000)
	if err != nil {
		return nil, err
	}

	for _, session := range sessions {
		browser := session.BrowserFamily
		if browser == "" {
			browser = "unknown"
		}
		distribution[browser]++
	}

	return distribution, nil
}
