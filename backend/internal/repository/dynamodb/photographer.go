package dynamodb

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"photographer-gallery/backend/internal/domain/photographer"
)

type PhotographerRepository struct {
	client    *dynamodb.Client
	tableName string
}

func NewPhotographerRepository(client *dynamodb.Client, tableName string) *PhotographerRepository {
	return &PhotographerRepository{
		client:    client,
		tableName: tableName,
	}
}

// GetByID retrieves a photographer by their user ID
func (r *PhotographerRepository) GetByID(ctx context.Context, userID string) (*photographer.Photographer, error) {
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userID)},
			"SK": &types.AttributeValueMemberS{Value: "METADATA"},
		},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to get photographer: %w", err)
	}

	if result.Item == nil {
		return nil, photographer.ErrNotFound
	}

	var p photographer.Photographer
	err = attributevalue.UnmarshalMap(result.Item, &p)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal photographer: %w", err)
	}

	return &p, nil
}

// GetByEmail retrieves a photographer by their email
func (r *PhotographerRepository) GetByEmail(ctx context.Context, email string) (*photographer.Photographer, error) {
	result, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		IndexName:              aws.String("EmailIndex"),
		KeyConditionExpression: aws.String("email = :email"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":email": &types.AttributeValueMemberS{Value: email},
		},
		Limit: aws.Int32(1),
	})

	if err != nil {
		return nil, fmt.Errorf("failed to query photographer by email: %w", err)
	}

	if len(result.Items) == 0 {
		return nil, photographer.ErrNotFound
	}

	var p photographer.Photographer
	err = attributevalue.UnmarshalMap(result.Items[0], &p)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal photographer: %w", err)
	}

	return &p, nil
}

// Create creates a new photographer
func (r *PhotographerRepository) Create(ctx context.Context, p *photographer.Photographer) error {
	now := time.Now().UTC().Format(time.RFC3339)
	p.CreatedAt = now
	p.UpdatedAt = now

	item := map[string]types.AttributeValue{
		"PK":          &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", p.UserID)},
		"SK":          &types.AttributeValueMemberS{Value: "METADATA"},
		"userId":      &types.AttributeValueMemberS{Value: p.UserID},
		"email":       &types.AttributeValueMemberS{Value: p.Email},
		"name":        &types.AttributeValueMemberS{Value: p.Name},
		"provider":    &types.AttributeValueMemberS{Value: p.Provider},
		"storageUsed": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", p.StorageUsed)},
		"plan":        &types.AttributeValueMemberS{Value: p.Plan},
		"createdAt":   &types.AttributeValueMemberS{Value: p.CreatedAt},
		"updatedAt":   &types.AttributeValueMemberS{Value: p.UpdatedAt},
	}

	_, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
		// Don't overwrite if already exists
		ConditionExpression: aws.String("attribute_not_exists(PK)"),
	})

	if err != nil {
		return fmt.Errorf("failed to create photographer: %w", err)
	}

	return nil
}

// Update updates an existing photographer
func (r *PhotographerRepository) Update(ctx context.Context, p *photographer.Photographer) error {
	now := time.Now().UTC().Format(time.RFC3339)
	p.UpdatedAt = now

	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", p.UserID)},
			"SK": &types.AttributeValueMemberS{Value: "METADATA"},
		},
		UpdateExpression: aws.String("SET #name = :name, storageUsed = :storageUsed, #plan = :plan, updatedAt = :updatedAt"),
		ExpressionAttributeNames: map[string]string{
			"#name": "name",
			"#plan": "plan",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":name":        &types.AttributeValueMemberS{Value: p.Name},
			":storageUsed": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", p.StorageUsed)},
			":plan":        &types.AttributeValueMemberS{Value: p.Plan},
			":updatedAt":   &types.AttributeValueMemberS{Value: now},
		},
	})

	if err != nil {
		return fmt.Errorf("failed to update photographer: %w", err)
	}

	return nil
}
