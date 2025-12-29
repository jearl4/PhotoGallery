package photographer

import "errors"

var (
	ErrNotFound = errors.New("photographer not found")
)

type Photographer struct {
	UserID      string `json:"userId" dynamodbav:"userId"`
	Email       string `json:"email" dynamodbav:"email"`
	Name        string `json:"name" dynamodbav:"name"`
	Provider    string `json:"provider" dynamodbav:"provider"` // google, facebook, apple, cognito
	StorageUsed int64  `json:"storageUsed" dynamodbav:"storageUsed"`
	Plan        string `json:"plan" dynamodbav:"plan"` // free, pro
	CreatedAt   string `json:"createdAt" dynamodbav:"createdAt"`
	UpdatedAt   string `json:"updatedAt" dynamodbav:"updatedAt"`
}
