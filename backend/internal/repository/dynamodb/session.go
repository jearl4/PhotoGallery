package dynamodb

import (
	"context"
	"fmt"

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
	}

	// Parse timestamps
	// Simple parsing - in production use proper time parsing
	// session.FirstAccessAt = time.Parse(...)
	// session.LastAccessAt = time.Parse(...)

	return session
}
