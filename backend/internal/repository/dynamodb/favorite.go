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

type FavoriteRepository struct {
	client    *dynamodb.Client
	tableName string
}

func NewFavoriteRepository(client *dynamodb.Client, tableName string) *FavoriteRepository {
	return &FavoriteRepository{
		client:    client,
		tableName: tableName,
	}
}

type favoriteItem struct {
	PK          string `dynamodbav:"PK"`
	SK          string `dynamodbav:"SK"`
	GalleryID   string `dynamodbav:"galleryId"`
	SessionID   string `dynamodbav:"sessionId"`
	PhotoID     string `dynamodbav:"photoId"`
	FavoritedAt string `dynamodbav:"favoritedAt"`
}

func (r *FavoriteRepository) Create(ctx context.Context, favorite *repository.Favorite) error {
	item := favoriteItem{
		PK:          fmt.Sprintf("GALLERY#%s#SESSION#%s", favorite.GalleryID, favorite.SessionID),
		SK:          fmt.Sprintf("PHOTO#%s", favorite.PhotoID),
		GalleryID:   favorite.GalleryID,
		SessionID:   favorite.SessionID,
		PhotoID:     favorite.PhotoID,
		FavoritedAt: favorite.FavoritedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("failed to marshal favorite: %w", err)
	}

	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      av,
	})

	return err
}

func (r *FavoriteRepository) Delete(ctx context.Context, galleryID, sessionID, photoID string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s#SESSION#%s", galleryID, sessionID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("PHOTO#%s", photoID)},
		},
	})

	return err
}

func (r *FavoriteRepository) IsFavorited(ctx context.Context, galleryID, sessionID, photoID string) (bool, error) {
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s#SESSION#%s", galleryID, sessionID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("PHOTO#%s", photoID)},
		},
	})

	if err != nil {
		return false, fmt.Errorf("failed to check favorite: %w", err)
	}

	return result.Item != nil, nil
}

func (r *FavoriteRepository) ListBySession(ctx context.Context, galleryID, sessionID string) ([]*repository.Favorite, error) {
	result, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		KeyConditionExpression: aws.String("PK = :pk"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: fmt.Sprintf("GALLERY#%s#SESSION#%s", galleryID, sessionID)},
		},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to list favorites by session: %w", err)
	}

	favorites := make([]*repository.Favorite, 0, len(result.Items))
	for _, item := range result.Items {
		var favoriteItem favoriteItem
		if err := attributevalue.UnmarshalMap(item, &favoriteItem); err != nil {
			return nil, fmt.Errorf("failed to unmarshal favorite: %w", err)
		}
		favorites = append(favorites, itemToFavorite(&favoriteItem))
	}

	return favorites, nil
}

func (r *FavoriteRepository) ListByGallery(ctx context.Context, galleryID string) ([]*repository.Favorite, error) {
	// Use Scan with filter expression since we need to query across multiple partition keys
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("galleryId = :galleryId"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":galleryId": &types.AttributeValueMemberS{Value: galleryID},
		},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to list favorites by gallery: %w", err)
	}

	favorites := make([]*repository.Favorite, 0, len(result.Items))
	for _, item := range result.Items {
		var favoriteItem favoriteItem
		if err := attributevalue.UnmarshalMap(item, &favoriteItem); err != nil {
			return nil, fmt.Errorf("failed to unmarshal favorite: %w", err)
		}
		favorites = append(favorites, itemToFavorite(&favoriteItem))
	}

	return favorites, nil
}

func itemToFavorite(item *favoriteItem) *repository.Favorite {
	favorite := &repository.Favorite{
		GalleryID: item.GalleryID,
		SessionID: item.SessionID,
		PhotoID:   item.PhotoID,
	}

	// Parse FavoritedAt
	// Simple parsing - in production use proper time parsing
	// favorite.FavoritedAt = time.Parse(...)

	return favorite
}
