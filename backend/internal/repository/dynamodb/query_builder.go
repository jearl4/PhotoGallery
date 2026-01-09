// Package dynamodb provides DynamoDB repository implementations and query utilities.
package dynamodb

import (
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/expression"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// QueryBuilder provides a fluent API for building DynamoDB query inputs.
type QueryBuilder struct {
	tableName       string
	indexName       *string
	keyCondition    expression.KeyConditionBuilder
	filterCondition *expression.ConditionBuilder
	projections     []expression.NameBuilder
	limit           *int32
	scanForward     *bool
	lastKey         map[string]types.AttributeValue
	consistentRead  *bool
}

// NewQueryBuilder creates a new QueryBuilder for the given table.
func NewQueryBuilder(tableName string) *QueryBuilder {
	return &QueryBuilder{
		tableName: tableName,
	}
}

// WithIndex sets the index to query.
func (qb *QueryBuilder) WithIndex(indexName string) *QueryBuilder {
	qb.indexName = aws.String(indexName)
	return qb
}

// WithKeyCondition sets the key condition for the query.
func (qb *QueryBuilder) WithKeyCondition(condition expression.KeyConditionBuilder) *QueryBuilder {
	qb.keyCondition = condition
	return qb
}

// WithPartitionKey sets a simple partition key equality condition.
func (qb *QueryBuilder) WithPartitionKey(name string, value string) *QueryBuilder {
	qb.keyCondition = expression.Key(name).Equal(expression.Value(value))
	return qb
}

// WithPartitionAndSortKey sets partition and sort key conditions.
func (qb *QueryBuilder) WithPartitionAndSortKey(pkName, pkValue, skName, skValue string) *QueryBuilder {
	pk := expression.Key(pkName).Equal(expression.Value(pkValue))
	sk := expression.Key(skName).Equal(expression.Value(skValue))
	qb.keyCondition = pk.And(sk)
	return qb
}

// WithSortKeyBeginsWith adds a sort key begins_with condition.
func (qb *QueryBuilder) WithSortKeyBeginsWith(pkName, pkValue, skName, skPrefix string) *QueryBuilder {
	pk := expression.Key(pkName).Equal(expression.Value(pkValue))
	sk := expression.Key(skName).BeginsWith(skPrefix)
	qb.keyCondition = pk.And(sk)
	return qb
}

// WithFilter adds a filter condition.
func (qb *QueryBuilder) WithFilter(condition expression.ConditionBuilder) *QueryBuilder {
	qb.filterCondition = &condition
	return qb
}

// WithStatusFilter adds a status = value filter.
func (qb *QueryBuilder) WithStatusFilter(status string) *QueryBuilder {
	condition := expression.Name("status").Equal(expression.Value(status))
	qb.filterCondition = &condition
	return qb
}

// WithProjection sets the attributes to project.
func (qb *QueryBuilder) WithProjection(attrs ...string) *QueryBuilder {
	for _, attr := range attrs {
		qb.projections = append(qb.projections, expression.Name(attr))
	}
	return qb
}

// WithLimit sets the maximum number of items to return.
func (qb *QueryBuilder) WithLimit(limit int32) *QueryBuilder {
	qb.limit = aws.Int32(limit)
	return qb
}

// WithScanForward sets the scan direction (true = ascending, false = descending).
func (qb *QueryBuilder) WithScanForward(forward bool) *QueryBuilder {
	qb.scanForward = aws.Bool(forward)
	return qb
}

// WithLastKey sets the exclusive start key for pagination.
func (qb *QueryBuilder) WithLastKey(lastKey map[string]types.AttributeValue) *QueryBuilder {
	qb.lastKey = lastKey
	return qb
}

// WithConsistentRead enables consistent read.
func (qb *QueryBuilder) WithConsistentRead(consistent bool) *QueryBuilder {
	qb.consistentRead = aws.Bool(consistent)
	return qb
}

// Build creates the QueryInput from the builder configuration.
func (qb *QueryBuilder) Build() (*dynamodb.QueryInput, error) {
	// Build expression
	builder := expression.NewBuilder().WithKeyCondition(qb.keyCondition)

	if qb.filterCondition != nil {
		builder = builder.WithFilter(*qb.filterCondition)
	}

	if len(qb.projections) > 0 {
		proj := expression.ProjectionBuilder{}
		for _, p := range qb.projections {
			proj = proj.AddNames(p)
		}
		builder = builder.WithProjection(proj)
	}

	expr, err := builder.Build()
	if err != nil {
		return nil, fmt.Errorf("failed to build expression: %w", err)
	}

	input := &dynamodb.QueryInput{
		TableName:                 aws.String(qb.tableName),
		IndexName:                 qb.indexName,
		KeyConditionExpression:    expr.KeyCondition(),
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
		FilterExpression:          expr.Filter(),
		ProjectionExpression:      expr.Projection(),
		Limit:                     qb.limit,
		ScanIndexForward:          qb.scanForward,
		ExclusiveStartKey:         qb.lastKey,
		ConsistentRead:            qb.consistentRead,
	}

	return input, nil
}

// ScanBuilder provides a fluent API for building DynamoDB scan inputs.
type ScanBuilder struct {
	tableName       string
	indexName       *string
	filterCondition *expression.ConditionBuilder
	projections     []expression.NameBuilder
	limit           *int32
	lastKey         map[string]types.AttributeValue
	consistentRead  *bool
}

// NewScanBuilder creates a new ScanBuilder for the given table.
func NewScanBuilder(tableName string) *ScanBuilder {
	return &ScanBuilder{
		tableName: tableName,
	}
}

// WithIndex sets the index to scan.
func (sb *ScanBuilder) WithIndex(indexName string) *ScanBuilder {
	sb.indexName = aws.String(indexName)
	return sb
}

// WithFilter adds a filter condition.
func (sb *ScanBuilder) WithFilter(condition expression.ConditionBuilder) *ScanBuilder {
	sb.filterCondition = &condition
	return sb
}

// WithLimit sets the maximum number of items to return.
func (sb *ScanBuilder) WithLimit(limit int32) *ScanBuilder {
	sb.limit = aws.Int32(limit)
	return sb
}

// WithLastKey sets the exclusive start key for pagination.
func (sb *ScanBuilder) WithLastKey(lastKey map[string]types.AttributeValue) *ScanBuilder {
	sb.lastKey = lastKey
	return sb
}

// Build creates the ScanInput from the builder configuration.
func (sb *ScanBuilder) Build() (*dynamodb.ScanInput, error) {
	input := &dynamodb.ScanInput{
		TableName:         aws.String(sb.tableName),
		IndexName:         sb.indexName,
		Limit:             sb.limit,
		ExclusiveStartKey: sb.lastKey,
		ConsistentRead:    sb.consistentRead,
	}

	if sb.filterCondition != nil {
		builder := expression.NewBuilder().WithFilter(*sb.filterCondition)
		expr, err := builder.Build()
		if err != nil {
			return nil, fmt.Errorf("failed to build expression: %w", err)
		}
		input.FilterExpression = expr.Filter()
		input.ExpressionAttributeNames = expr.Names()
		input.ExpressionAttributeValues = expr.Values()
	}

	return input, nil
}

// UpdateBuilder provides a fluent API for building DynamoDB update inputs.
type UpdateBuilder struct {
	tableName  string
	key        map[string]types.AttributeValue
	updates    expression.UpdateBuilder
	conditions *expression.ConditionBuilder
}

// NewUpdateBuilder creates a new UpdateBuilder for the given table and key.
func NewUpdateBuilder(tableName string, key map[string]types.AttributeValue) *UpdateBuilder {
	return &UpdateBuilder{
		tableName: tableName,
		key:       key,
		updates:   expression.UpdateBuilder{},
	}
}

// Set adds a SET operation to the update.
func (ub *UpdateBuilder) Set(name string, value interface{}) *UpdateBuilder {
	ub.updates = ub.updates.Set(expression.Name(name), expression.Value(value))
	return ub
}

// Add adds an ADD operation to the update (for numbers and sets).
func (ub *UpdateBuilder) Add(name string, value interface{}) *UpdateBuilder {
	ub.updates = ub.updates.Add(expression.Name(name), expression.Value(value))
	return ub
}

// Remove adds a REMOVE operation to the update.
func (ub *UpdateBuilder) Remove(name string) *UpdateBuilder {
	ub.updates = ub.updates.Remove(expression.Name(name))
	return ub
}

// WithCondition adds a condition expression.
func (ub *UpdateBuilder) WithCondition(condition expression.ConditionBuilder) *UpdateBuilder {
	ub.conditions = &condition
	return ub
}

// Build creates the UpdateItemInput from the builder configuration.
func (ub *UpdateBuilder) Build() (*dynamodb.UpdateItemInput, error) {
	builder := expression.NewBuilder().WithUpdate(ub.updates)

	if ub.conditions != nil {
		builder = builder.WithCondition(*ub.conditions)
	}

	expr, err := builder.Build()
	if err != nil {
		return nil, fmt.Errorf("failed to build expression: %w", err)
	}

	return &dynamodb.UpdateItemInput{
		TableName:                 aws.String(ub.tableName),
		Key:                       ub.key,
		UpdateExpression:          expr.Update(),
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
		ConditionExpression:       expr.Condition(),
		ReturnValues:              types.ReturnValueAllNew,
	}, nil
}
