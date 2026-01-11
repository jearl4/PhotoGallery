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

// GetBySubdomain retrieves a photographer by their subdomain
func (r *PhotographerRepository) GetBySubdomain(ctx context.Context, subdomain string) (*photographer.Photographer, error) {
	result, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		IndexName:              aws.String("SubdomainIndex"),
		KeyConditionExpression: aws.String("subdomain = :subdomain"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":subdomain": &types.AttributeValueMemberS{Value: subdomain},
		},
		Limit: aws.Int32(1),
	})

	if err != nil {
		return nil, fmt.Errorf("failed to query photographer by subdomain: %w", err)
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

// GetByCustomDomain retrieves a photographer by their custom domain
func (r *PhotographerRepository) GetByCustomDomain(ctx context.Context, domain string) (*photographer.Photographer, error) {
	result, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		IndexName:              aws.String("CustomDomainIndex"),
		KeyConditionExpression: aws.String("customDomain = :domain"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":domain": &types.AttributeValueMemberS{Value: domain},
		},
		Limit: aws.Int32(1),
	})

	if err != nil {
		return nil, fmt.Errorf("failed to query photographer by custom domain: %w", err)
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

// UpdateDomain updates the domain configuration for a photographer
func (r *PhotographerRepository) UpdateDomain(ctx context.Context, userID string, subdomain, customDomain, domainStatus, verificationToken, certificateArn string) error {
	now := time.Now().UTC().Format(time.RFC3339)

	updateExpr := "SET updatedAt = :updatedAt"
	exprAttrValues := map[string]types.AttributeValue{
		":updatedAt": &types.AttributeValueMemberS{Value: now},
	}
	exprAttrNames := map[string]string{}

	// Handle subdomain (can be empty to remove)
	if subdomain != "" {
		updateExpr += ", subdomain = :subdomain"
		exprAttrValues[":subdomain"] = &types.AttributeValueMemberS{Value: subdomain}
	}

	// Handle custom domain
	if customDomain != "" {
		updateExpr += ", customDomain = :customDomain"
		exprAttrValues[":customDomain"] = &types.AttributeValueMemberS{Value: customDomain}
	}

	// Handle domain status
	if domainStatus != "" {
		updateExpr += ", domainStatus = :domainStatus"
		exprAttrValues[":domainStatus"] = &types.AttributeValueMemberS{Value: domainStatus}
	}

	// Handle verification token
	if verificationToken != "" {
		updateExpr += ", verificationToken = :verificationToken"
		exprAttrValues[":verificationToken"] = &types.AttributeValueMemberS{Value: verificationToken}
	}

	// Handle certificate ARN
	if certificateArn != "" {
		updateExpr += ", certificateArn = :certificateArn"
		exprAttrValues[":certificateArn"] = &types.AttributeValueMemberS{Value: certificateArn}
	}

	// Set domainVerifiedAt if status is being set to verified or active
	if domainStatus == "verified" || domainStatus == "active" {
		updateExpr += ", domainVerifiedAt = :domainVerifiedAt"
		exprAttrValues[":domainVerifiedAt"] = &types.AttributeValueMemberS{Value: now}
	}

	input := &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userID)},
			"SK": &types.AttributeValueMemberS{Value: "METADATA"},
		},
		UpdateExpression:          aws.String(updateExpr),
		ExpressionAttributeValues: exprAttrValues,
	}

	if len(exprAttrNames) > 0 {
		input.ExpressionAttributeNames = exprAttrNames
	}

	_, err := r.client.UpdateItem(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to update photographer domain: %w", err)
	}

	return nil
}

// ClearDomain removes all domain configuration for a photographer
func (r *PhotographerRepository) ClearDomain(ctx context.Context, userID string) error {
	now := time.Now().UTC().Format(time.RFC3339)

	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userID)},
			"SK": &types.AttributeValueMemberS{Value: "METADATA"},
		},
		UpdateExpression: aws.String("SET updatedAt = :updatedAt REMOVE subdomain, customDomain, domainStatus, verificationToken, certificateArn, domainVerifiedAt"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":updatedAt": &types.AttributeValueMemberS{Value: now},
		},
	})

	if err != nil {
		return fmt.Errorf("failed to clear photographer domain: %w", err)
	}

	return nil
}

// Analytics methods

// IncrementTotalViews increments the total views counter
func (r *PhotographerRepository) IncrementTotalViews(ctx context.Context, userID string, delta int64) error {
	return r.incrementCounter(ctx, userID, "totalViews", delta)
}

// IncrementTotalDownloads increments the total downloads counter
func (r *PhotographerRepository) IncrementTotalDownloads(ctx context.Context, userID string, delta int64) error {
	return r.incrementCounter(ctx, userID, "totalDownloads", delta)
}

// IncrementTotalFavorites increments the total favorites counter
func (r *PhotographerRepository) IncrementTotalFavorites(ctx context.Context, userID string, delta int) error {
	return r.incrementCounter(ctx, userID, "totalFavorites", int64(delta))
}

// IncrementTotalGalleries increments the total galleries counter
func (r *PhotographerRepository) IncrementTotalGalleries(ctx context.Context, userID string, delta int) error {
	return r.incrementCounter(ctx, userID, "totalGalleries", int64(delta))
}

// IncrementTotalPhotos increments the total photos counter
func (r *PhotographerRepository) IncrementTotalPhotos(ctx context.Context, userID string, delta int) error {
	return r.incrementCounter(ctx, userID, "totalPhotos", int64(delta))
}

// IncrementTotalClients increments the total unique clients counter
func (r *PhotographerRepository) IncrementTotalClients(ctx context.Context, userID string, delta int64) error {
	return r.incrementCounter(ctx, userID, "totalClients", delta)
}

// IncrementActiveGalleries increments the active galleries counter
func (r *PhotographerRepository) IncrementActiveGalleries(ctx context.Context, userID string, delta int) error {
	return r.incrementCounter(ctx, userID, "activeGalleries", int64(delta))
}

// incrementCounter is a helper to increment any numeric counter field
func (r *PhotographerRepository) incrementCounter(ctx context.Context, userID string, field string, delta int64) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userID)},
			"SK": &types.AttributeValueMemberS{Value: "METADATA"},
		},
		UpdateExpression: aws.String(fmt.Sprintf("SET #field = if_not_exists(#field, :zero) + :delta")),
		ExpressionAttributeNames: map[string]string{
			"#field": field,
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":delta": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", delta)},
			":zero":  &types.AttributeValueMemberN{Value: "0"},
		},
	})

	if err != nil {
		return fmt.Errorf("failed to increment %s: %w", field, err)
	}

	return nil
}
