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

// GalleryRepository implements repository.GalleryRepository using DynamoDB.
type GalleryRepository struct {
	client    *dynamodb.Client
	tableName string
}

// NewGalleryRepository creates a new DynamoDB-backed gallery repository.
func NewGalleryRepository(client *dynamodb.Client, tableName string) *GalleryRepository {
	return &GalleryRepository{client: client, tableName: tableName}
}

type galleryItem struct {
	PK, SK                                    string  `dynamodbav:"PK,SK"`
	GalleryID, PhotographerID                 string  `dynamodbav:"galleryId,photographerId"`
	Name, Description, CustomURL, Password    string  `dynamodbav:"name,description,customUrl,password"`
	CreatedAt, Status                         string  `dynamodbav:"createdAt,status"`
	ExpiresAt                                 *string `dynamodbav:"expiresAt,omitempty"`
	PhotoCount, ClientAccessCount             int     `dynamodbav:"photoCount,clientAccessCount"`
	TotalSize                                 int64   `dynamodbav:"totalSize"`
	EnableWatermark                           bool    `dynamodbav:"enableWatermark"`
	WatermarkText, WatermarkPosition          string  `dynamodbav:"watermarkText,watermarkPosition,omitempty"`
}

func (r *GalleryRepository) Create(ctx context.Context, gallery *repository.Gallery) error {
	return r.save(ctx, gallery)
}

func (r *GalleryRepository) Update(ctx context.Context, gallery *repository.Gallery) error {
	return r.save(ctx, gallery)
}

func (r *GalleryRepository) save(ctx context.Context, gallery *repository.Gallery) error {
	item := r.toItem(gallery)
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
	return r.queryOne(ctx, "GalleryIdIndex", "galleryId = :v", map[string]types.AttributeValue{
		":v": &types.AttributeValueMemberS{Value: galleryID},
	})
}

func (r *GalleryRepository) GetByCustomURL(ctx context.Context, customURL string) (*repository.Gallery, error) {
	return r.queryOne(ctx, "CustomUrlIndex", "customUrl = :v", map[string]types.AttributeValue{
		":v": &types.AttributeValueMemberS{Value: customURL},
	})
}

func (r *GalleryRepository) queryOne(ctx context.Context, index, keyExpr string, values map[string]types.AttributeValue) (*repository.Gallery, error) {
	result, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:                 aws.String(r.tableName),
		IndexName:                 aws.String(index),
		KeyConditionExpression:    aws.String(keyExpr),
		ExpressionAttributeValues: values,
		Limit:                     aws.Int32(1),
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
	return r.fromItem(&item), nil
}

func (r *GalleryRepository) ListByPhotographer(ctx context.Context, photographerID string, limit int, lastKey map[string]interface{}) ([]*repository.Gallery, map[string]interface{}, error) {
	input := &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :sk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: fmt.Sprintf("PHOTOGRAPHER#%s", photographerID)},
			":sk": &types.AttributeValueMemberS{Value: "GALLERY#"},
		},
		Limit:            aws.Int32(int32(limit)),
		ScanIndexForward: aws.Bool(false),
	}
	if lastKey != nil {
		if startKey, err := attributevalue.MarshalMap(lastKey); err == nil {
			input.ExclusiveStartKey = startKey
		}
	}

	result, err := r.client.Query(ctx, input)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list galleries: %w", err)
	}

	galleries := make([]*repository.Gallery, 0, len(result.Items))
	for _, item := range result.Items {
		var gi galleryItem
		if err := attributevalue.UnmarshalMap(item, &gi); err != nil {
			return nil, nil, fmt.Errorf("failed to unmarshal gallery: %w", err)
		}
		galleries = append(galleries, r.fromItem(&gi))
	}

	var nextKey map[string]interface{}
	if result.LastEvaluatedKey != nil {
		attributevalue.UnmarshalMap(result.LastEvaluatedKey, &nextKey)
	}
	return galleries, nextKey, nil
}

func (r *GalleryRepository) Delete(ctx context.Context, galleryID string) error {
	gallery, err := r.GetByID(ctx, galleryID)
	if err != nil || gallery == nil {
		return err
	}
	_, err = r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key:       r.key(gallery.PhotographerID, galleryID),
	})
	return err
}

func (r *GalleryRepository) ListExpired(ctx context.Context, limit int) ([]*repository.Gallery, error) {
	now := time.Now().Format(time.RFC3339)
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
		var gi galleryItem
		if err := attributevalue.UnmarshalMap(item, &gi); err != nil {
			return nil, fmt.Errorf("failed to unmarshal gallery: %w", err)
		}
		galleries = append(galleries, r.fromItem(&gi))
	}
	return galleries, nil
}

func (r *GalleryRepository) UpdatePhotoCount(ctx context.Context, galleryID string, delta int) error {
	return r.atomicUpdate(ctx, galleryID, "SET photoCount = photoCount + :v", map[string]types.AttributeValue{
		":v": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", delta)},
	})
}

func (r *GalleryRepository) UpdateTotalSize(ctx context.Context, galleryID string, deltaBytes int64) error {
	return r.atomicUpdate(ctx, galleryID, "SET totalSize = totalSize + :v", map[string]types.AttributeValue{
		":v": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", deltaBytes)},
	})
}

func (r *GalleryRepository) IncrementClientAccessCount(ctx context.Context, galleryID string) error {
	return r.atomicUpdate(ctx, galleryID, "SET clientAccessCount = clientAccessCount + :v", map[string]types.AttributeValue{
		":v": &types.AttributeValueMemberN{Value: "1"},
	})
}

func (r *GalleryRepository) atomicUpdate(ctx context.Context, galleryID, updateExpr string, values map[string]types.AttributeValue) error {
	gallery, err := r.GetByID(ctx, galleryID)
	if err != nil {
		return err
	}
	if gallery == nil {
		return fmt.Errorf("gallery not found")
	}
	_, err = r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(r.tableName),
		Key:                       r.key(gallery.PhotographerID, galleryID),
		UpdateExpression:          aws.String(updateExpr),
		ExpressionAttributeValues: values,
	})
	return err
}

func (r *GalleryRepository) key(photographerID, galleryID string) map[string]types.AttributeValue {
	return map[string]types.AttributeValue{
		"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("PHOTOGRAPHER#%s", photographerID)},
		"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s", galleryID)},
	}
}

func (r *GalleryRepository) toItem(g *repository.Gallery) *galleryItem {
	item := &galleryItem{
		PK:                fmt.Sprintf("PHOTOGRAPHER#%s", g.PhotographerID),
		SK:                fmt.Sprintf("GALLERY#%s", g.GalleryID),
		GalleryID:         g.GalleryID,
		PhotographerID:    g.PhotographerID,
		Name:              g.Name,
		Description:       g.Description,
		CustomURL:         g.CustomURL,
		Password:          g.Password,
		CreatedAt:         g.CreatedAt.Format(time.RFC3339),
		Status:            g.Status,
		PhotoCount:        g.PhotoCount,
		TotalSize:         g.TotalSize,
		ClientAccessCount: g.ClientAccessCount,
		EnableWatermark:   g.EnableWatermark,
		WatermarkText:     g.WatermarkText,
		WatermarkPosition: g.WatermarkPosition,
	}
	if g.ExpiresAt != nil {
		s := g.ExpiresAt.Format(time.RFC3339)
		item.ExpiresAt = &s
	}
	return item
}

func (r *GalleryRepository) fromItem(item *galleryItem) *repository.Gallery {
	g := &repository.Gallery{
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
	if t, err := time.Parse(time.RFC3339, item.CreatedAt); err == nil {
		g.CreatedAt = t
	}
	if item.ExpiresAt != nil {
		if t, err := time.Parse(time.RFC3339, *item.ExpiresAt); err == nil {
			g.ExpiresAt = &t
		}
	}
	return g
}
