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

type PhotoRepository struct {
	client    *dynamodb.Client
	tableName string
}

func NewPhotoRepository(client *dynamodb.Client, tableName string) *PhotoRepository {
	return &PhotoRepository{
		client:    client,
		tableName: tableName,
	}
}

type photoItem struct {
	PK               string            `dynamodbav:"PK"`
	SK               string            `dynamodbav:"SK"`
	PhotoID          string            `dynamodbav:"photoId"`
	GalleryID        string            `dynamodbav:"galleryId"`
	FileName         string            `dynamodbav:"fileName"`
	OriginalKey      string            `dynamodbav:"originalKey"`
	OptimizedKey     string            `dynamodbav:"optimizedKey,omitempty"`
	ThumbnailKey     string            `dynamodbav:"thumbnailKey,omitempty"`
	MimeType         string            `dynamodbav:"mimeType"`
	Size             int64             `dynamodbav:"size"`
	Width            int               `dynamodbav:"width,omitempty"`
	Height           int               `dynamodbav:"height,omitempty"`
	ProcessingStatus string            `dynamodbav:"processingStatus"`
	UploadedAt       string            `dynamodbav:"uploadedAt"`
	ProcessedAt      string            `dynamodbav:"processedAt,omitempty"`
	FavoriteCount    int               `dynamodbav:"favoriteCount"`
	DownloadCount    int               `dynamodbav:"downloadCount"`
	Metadata         map[string]string `dynamodbav:"metadata,omitempty"`
}

func (r *PhotoRepository) Create(ctx context.Context, photo *repository.Photo) error {
	item := photoItem{
		PK:               fmt.Sprintf("GALLERY#%s", photo.GalleryID),
		SK:               fmt.Sprintf("PHOTO#%s", photo.PhotoID),
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
		UploadedAt:       photo.UploadedAt.Format("2006-01-02T15:04:05Z07:00"),
		FavoriteCount:    photo.FavoriteCount,
		DownloadCount:    photo.DownloadCount,
		Metadata:         photo.Metadata,
	}

	if photo.ProcessedAt != nil {
		item.ProcessedAt = photo.ProcessedAt.Format("2006-01-02T15:04:05Z07:00")
	}

	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("failed to marshal photo: %w", err)
	}

	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      av,
	})

	return err
}

func (r *PhotoRepository) GetByID(ctx context.Context, photoID string) (*repository.Photo, error) {
	// Query using GSI1 (PhotoIdIndex)
	result, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		IndexName:              aws.String("PhotoIdIndex"),
		KeyConditionExpression: aws.String("photoId = :photoId"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":photoId": &types.AttributeValueMemberS{Value: photoID},
		},
		Limit: aws.Int32(1),
	})

	if err != nil {
		return nil, fmt.Errorf("failed to query photo: %w", err)
	}

	if len(result.Items) == 0 {
		return nil, nil
	}

	var item photoItem
	if err := attributevalue.UnmarshalMap(result.Items[0], &item); err != nil {
		return nil, fmt.Errorf("failed to unmarshal photo: %w", err)
	}

	return itemToPhoto(&item), nil
}

func (r *PhotoRepository) ListByGallery(ctx context.Context, galleryID string, limit int, lastEvaluatedKey map[string]interface{}) ([]*repository.Photo, map[string]interface{}, error) {
	input := &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :sk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s", galleryID)},
			":sk": &types.AttributeValueMemberS{Value: "PHOTO#"},
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
		return nil, nil, fmt.Errorf("failed to list photos: %w", err)
	}

	photos := make([]*repository.Photo, 0, len(result.Items))
	for _, item := range result.Items {
		var photoItem photoItem
		if err := attributevalue.UnmarshalMap(item, &photoItem); err != nil {
			return nil, nil, fmt.Errorf("failed to unmarshal photo: %w", err)
		}
		photos = append(photos, itemToPhoto(&photoItem))
	}

	var nextKey map[string]interface{}
	if result.LastEvaluatedKey != nil {
		if err := attributevalue.UnmarshalMap(result.LastEvaluatedKey, &nextKey); err != nil {
			return nil, nil, fmt.Errorf("failed to unmarshal last evaluated key: %w", err)
		}
	}

	return photos, nextKey, nil
}

func (r *PhotoRepository) Update(ctx context.Context, photo *repository.Photo) error {
	item := photoItem{
		PK:               fmt.Sprintf("GALLERY#%s", photo.GalleryID),
		SK:               fmt.Sprintf("PHOTO#%s", photo.PhotoID),
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
		UploadedAt:       photo.UploadedAt.Format("2006-01-02T15:04:05Z07:00"),
		FavoriteCount:    photo.FavoriteCount,
		DownloadCount:    photo.DownloadCount,
		Metadata:         photo.Metadata,
	}

	if photo.ProcessedAt != nil {
		item.ProcessedAt = photo.ProcessedAt.Format("2006-01-02T15:04:05Z07:00")
	}

	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("failed to marshal photo: %w", err)
	}

	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      av,
	})

	return err
}

func (r *PhotoRepository) Delete(ctx context.Context, photoID string) error {
	// First get the photo to get the gallery ID
	photo, err := r.GetByID(ctx, photoID)
	if err != nil {
		return err
	}
	if photo == nil {
		return nil
	}

	_, err = r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s", photo.GalleryID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("PHOTO#%s", photoID)},
		},
	})

	return err
}

func (r *PhotoRepository) IncrementFavoriteCount(ctx context.Context, photoID string, delta int) error {
	photo, err := r.GetByID(ctx, photoID)
	if err != nil {
		return err
	}
	if photo == nil {
		return fmt.Errorf("photo not found")
	}

	_, err = r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s", photo.GalleryID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("PHOTO#%s", photoID)},
		},
		UpdateExpression: aws.String("SET favoriteCount = favoriteCount + :delta"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":delta": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", delta)},
		},
	})

	return err
}

func (r *PhotoRepository) IncrementDownloadCount(ctx context.Context, photoID string) error {
	photo, err := r.GetByID(ctx, photoID)
	if err != nil {
		return err
	}
	if photo == nil {
		return fmt.Errorf("photo not found")
	}

	_, err = r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s", photo.GalleryID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("PHOTO#%s", photoID)},
		},
		UpdateExpression: aws.String("SET downloadCount = downloadCount + :one"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":one": &types.AttributeValueMemberN{Value: "1"},
		},
	})

	return err
}

func itemToPhoto(item *photoItem) *repository.Photo {
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
		FavoriteCount:    item.FavoriteCount,
		DownloadCount:    item.DownloadCount,
		Metadata:         item.Metadata,
	}

	// Parse UploadedAt
	// Simple parsing - in production use proper time parsing
	// photo.UploadedAt = time.Parse(...)

	return photo
}
