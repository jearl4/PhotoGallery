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

type GalleryRepository struct {
	client    *dynamodb.Client
	tableName string
}

func NewGalleryRepository(client *dynamodb.Client, tableName string) *GalleryRepository {
	return &GalleryRepository{
		client:    client,
		tableName: tableName,
	}
}

type galleryItem struct {
	PK                string     `dynamodbav:"PK"`
	SK                string     `dynamodbav:"SK"`
	GalleryID         string     `dynamodbav:"galleryId"`
	PhotographerID    string     `dynamodbav:"photographerId"`
	Name              string     `dynamodbav:"name"`
	Description       string     `dynamodbav:"description"`
	CustomURL         string     `dynamodbav:"customUrl"`
	Password          string     `dynamodbav:"password"`
	CreatedAt         string     `dynamodbav:"createdAt"`
	ExpiresAt         *string    `dynamodbav:"expiresAt,omitempty"`
	Status            string     `dynamodbav:"status"`
	PhotoCount        int        `dynamodbav:"photoCount"`
	TotalSize         int64      `dynamodbav:"totalSize"`
	ClientAccessCount int        `dynamodbav:"clientAccessCount"`
	EnableWatermark   bool       `dynamodbav:"enableWatermark"`
	WatermarkText     string     `dynamodbav:"watermarkText,omitempty"`
	WatermarkPosition string     `dynamodbav:"watermarkPosition,omitempty"`
}

func (r *GalleryRepository) Create(ctx context.Context, gallery *repository.Gallery) error {
	item := galleryItem{
		PK:                fmt.Sprintf("PHOTOGRAPHER#%s", gallery.PhotographerID),
		SK:                fmt.Sprintf("GALLERY#%s", gallery.GalleryID),
		GalleryID:         gallery.GalleryID,
		PhotographerID:    gallery.PhotographerID,
		Name:              gallery.Name,
		Description:       gallery.Description,
		CustomURL:         gallery.CustomURL,
		Password:          gallery.Password,
		CreatedAt:         gallery.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Status:            gallery.Status,
		PhotoCount:        gallery.PhotoCount,
		TotalSize:         gallery.TotalSize,
		ClientAccessCount: gallery.ClientAccessCount,
		EnableWatermark:   gallery.EnableWatermark,
		WatermarkText:     gallery.WatermarkText,
		WatermarkPosition: gallery.WatermarkPosition,
	}

	if gallery.ExpiresAt != nil {
		expiresAtStr := gallery.ExpiresAt.Format("2006-01-02T15:04:05Z07:00")
		item.ExpiresAt = &expiresAtStr
	}

	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("failed to marshal gallery: %w", err)
	}

	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      av,
	})

	return err
}

func (r *GalleryRepository) GetByID(ctx context.Context, galleryID string) (*repository.Gallery, error) {
	// Query using GSI1 (GalleryIdIndex)
	result, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		IndexName:              aws.String("GalleryIdIndex"),
		KeyConditionExpression: aws.String("galleryId = :galleryId"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":galleryId": &types.AttributeValueMemberS{Value: galleryID},
		},
		Limit: aws.Int32(1),
	})

	if err != nil {
		return nil, fmt.Errorf("failed to query gallery: %w", err)
	}

	if len(result.Items) == 0 {
		return nil, nil
	}

	var item galleryItem
	if err := attributevalue.UnmarshalMap(result.Items[0], &item); err != nil {
		return nil, fmt.Errorf("failed to unmarshal gallery: %w", err)
	}

	return itemToGallery(&item), nil
}

func (r *GalleryRepository) GetByCustomURL(ctx context.Context, customURL string) (*repository.Gallery, error) {
	// Query using GSI2 (CustomUrlIndex)
	result, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		IndexName:              aws.String("CustomUrlIndex"),
		KeyConditionExpression: aws.String("customUrl = :customUrl"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":customUrl": &types.AttributeValueMemberS{Value: customURL},
		},
		Limit: aws.Int32(1),
	})

	if err != nil {
		return nil, fmt.Errorf("failed to query gallery by custom URL: %w", err)
	}

	if len(result.Items) == 0 {
		return nil, nil
	}

	var item galleryItem
	if err := attributevalue.UnmarshalMap(result.Items[0], &item); err != nil {
		return nil, fmt.Errorf("failed to unmarshal gallery: %w", err)
	}

	return itemToGallery(&item), nil
}

func (r *GalleryRepository) ListByPhotographer(ctx context.Context, photographerID string, limit int, lastEvaluatedKey map[string]interface{}) ([]*repository.Gallery, map[string]interface{}, error) {
	input := &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :sk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: fmt.Sprintf("PHOTOGRAPHER#%s", photographerID)},
			":sk": &types.AttributeValueMemberS{Value: "GALLERY#"},
		},
		Limit:            aws.Int32(int32(limit)),
		ScanIndexForward: aws.Bool(false), // Most recent first
	}

	if lastEvaluatedKey != nil {
		exclusiveStartKey, err := attributevalue.MarshalMap(lastEvaluatedKey)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to marshal last evaluated key: %w", err)
		}
		input.ExclusiveStartKey = exclusiveStartKey
	}

	result, err := r.client.Query(ctx, input)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list galleries: %w", err)
	}

	galleries := make([]*repository.Gallery, 0, len(result.Items))
	for _, item := range result.Items {
		var galleryItem galleryItem
		if err := attributevalue.UnmarshalMap(item, &galleryItem); err != nil {
			return nil, nil, fmt.Errorf("failed to unmarshal gallery: %w", err)
		}
		galleries = append(galleries, itemToGallery(&galleryItem))
	}

	var nextKey map[string]interface{}
	if result.LastEvaluatedKey != nil {
		if err := attributevalue.UnmarshalMap(result.LastEvaluatedKey, &nextKey); err != nil {
			return nil, nil, fmt.Errorf("failed to unmarshal last evaluated key: %w", err)
		}
	}

	return galleries, nextKey, nil
}

func (r *GalleryRepository) Update(ctx context.Context, gallery *repository.Gallery) error {
	item := galleryItem{
		PK:                fmt.Sprintf("PHOTOGRAPHER#%s", gallery.PhotographerID),
		SK:                fmt.Sprintf("GALLERY#%s", gallery.GalleryID),
		GalleryID:         gallery.GalleryID,
		PhotographerID:    gallery.PhotographerID,
		Name:              gallery.Name,
		Description:       gallery.Description,
		CustomURL:         gallery.CustomURL,
		Password:          gallery.Password,
		CreatedAt:         gallery.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Status:            gallery.Status,
		PhotoCount:        gallery.PhotoCount,
		TotalSize:         gallery.TotalSize,
		ClientAccessCount: gallery.ClientAccessCount,
		EnableWatermark:   gallery.EnableWatermark,
		WatermarkText:     gallery.WatermarkText,
		WatermarkPosition: gallery.WatermarkPosition,
	}

	if gallery.ExpiresAt != nil {
		expiresAtStr := gallery.ExpiresAt.Format("2006-01-02T15:04:05Z07:00")
		item.ExpiresAt = &expiresAtStr
	}

	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("failed to marshal gallery: %w", err)
	}

	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      av,
	})

	return err
}

func (r *GalleryRepository) Delete(ctx context.Context, galleryID string) error {
	// First get the gallery to get the photographer ID
	gallery, err := r.GetByID(ctx, galleryID)
	if err != nil {
		return err
	}
	if gallery == nil {
		return nil
	}

	_, err = r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("PHOTOGRAPHER#%s", gallery.PhotographerID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s", galleryID)},
		},
	})

	return err
}

func (r *GalleryRepository) ListExpired(ctx context.Context, limit int) ([]*repository.Gallery, error) {
	// Query using GSI3 (StatusExpirationIndex) for active galleries with expiresAt < now
	now := fmt.Sprintf("%d", 0) // Placeholder - would use actual timestamp

	result, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		IndexName:              aws.String("StatusExpirationIndex"),
		KeyConditionExpression: aws.String("#status = :status AND expiresAt < :now"),
		ExpressionAttributeNames: map[string]string{
			"#status": "status",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":status": &types.AttributeValueMemberS{Value: "active"},
			":now":    &types.AttributeValueMemberS{Value: now},
		},
		Limit: aws.Int32(int32(limit)),
	})

	if err != nil {
		return nil, fmt.Errorf("failed to list expired galleries: %w", err)
	}

	galleries := make([]*repository.Gallery, 0, len(result.Items))
	for _, item := range result.Items {
		var galleryItem galleryItem
		if err := attributevalue.UnmarshalMap(item, &galleryItem); err != nil {
			return nil, fmt.Errorf("failed to unmarshal gallery: %w", err)
		}
		galleries = append(galleries, itemToGallery(&galleryItem))
	}

	return galleries, nil
}

func (r *GalleryRepository) UpdatePhotoCount(ctx context.Context, galleryID string, delta int) error {
	gallery, err := r.GetByID(ctx, galleryID)
	if err != nil {
		return err
	}
	if gallery == nil {
		return fmt.Errorf("gallery not found")
	}

	_, err = r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("PHOTOGRAPHER#%s", gallery.PhotographerID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s", galleryID)},
		},
		UpdateExpression: aws.String("SET photoCount = photoCount + :delta"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":delta": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", delta)},
		},
	})

	return err
}

func (r *GalleryRepository) UpdateTotalSize(ctx context.Context, galleryID string, deltaBytes int64) error {
	gallery, err := r.GetByID(ctx, galleryID)
	if err != nil {
		return err
	}
	if gallery == nil {
		return fmt.Errorf("gallery not found")
	}

	_, err = r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("PHOTOGRAPHER#%s", gallery.PhotographerID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s", galleryID)},
		},
		UpdateExpression: aws.String("SET totalSize = totalSize + :delta"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":delta": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", deltaBytes)},
		},
	})

	return err
}

func (r *GalleryRepository) IncrementClientAccessCount(ctx context.Context, galleryID string) error {
	gallery, err := r.GetByID(ctx, galleryID)
	if err != nil {
		return err
	}
	if gallery == nil {
		return fmt.Errorf("gallery not found")
	}

	_, err = r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("PHOTOGRAPHER#%s", gallery.PhotographerID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s", galleryID)},
		},
		UpdateExpression: aws.String("SET clientAccessCount = clientAccessCount + :one"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":one": &types.AttributeValueMemberN{Value: "1"},
		},
	})

	return err
}

func itemToGallery(item *galleryItem) *repository.Gallery {
	gallery := &repository.Gallery{
		GalleryID:         item.GalleryID,
		PhotographerID:    item.PhotographerID,
		Name:              item.Name,
		Description:       item.Description,
		CustomURL:         item.CustomURL,
		Password:          item.Password,
		Status:            item.Status,
		PhotoCount:        item.PhotoCount,
		TotalSize:         item.TotalSize,
		ClientAccessCount: item.ClientAccessCount,
		EnableWatermark:   item.EnableWatermark,
		WatermarkText:     item.WatermarkText,
		WatermarkPosition: item.WatermarkPosition,
	}

	// Parse CreatedAt
	if item.CreatedAt != "" {
		if t, err := parseTime(item.CreatedAt); err == nil {
			gallery.CreatedAt = t
		}
	}

	// Parse ExpiresAt
	if item.ExpiresAt != nil && *item.ExpiresAt != "" {
		if t, err := parseTime(*item.ExpiresAt); err == nil {
			gallery.ExpiresAt = &t
		}
	}

	return gallery
}

func parseTime(timeStr string) (time.Time, error) {
	// Try ISO 8601 format first
	t, err := time.Parse("2006-01-02T15:04:05Z07:00", timeStr)
	if err == nil {
		return t, nil
	}
	// Fallback to RFC3339
	return time.Parse(time.RFC3339, timeStr)
}
