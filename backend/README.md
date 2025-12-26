# Photographer Gallery Backend

Go-based serverless backend for the photographer gallery application.

## Architecture

- **Lambda Functions**: Serverless compute using AWS Lambda
- **DynamoDB**: NoSQL database for all data storage
- **S3**: Object storage for photos
- **API Gateway**: REST API endpoint

## Project Structure

```
backend/
├── cmd/
│   ├── api/              # Main API Lambda handler
│   ├── processor/        # Photo processing Lambda
│   └── scheduler/        # Gallery expiration scheduler
├── internal/
│   ├── api/
│   │   └── handlers/    # HTTP request handlers
│   ├── domain/
│   │   ├── gallery/     # Gallery business logic
│   │   ├── photo/       # Photo business logic
│   │   └── auth/        # Auth business logic
│   ├── repository/
│   │   └── dynamodb/    # DynamoDB data access
│   ├── services/
│   │   ├── storage/     # S3 operations
│   │   └── auth/        # Cognito JWT verification
│   └── config/          # Configuration management
└── pkg/
    ├── errors/          # Error handling utilities
    ├── logger/          # Structured logging
    └── utils/           # Common utilities
```

## Development

### Prerequisites

- Go 1.21+
- AWS CLI configured
- Access to AWS account

### Install Dependencies

```bash
go mod download
```

### Build

```bash
# Build for local development
go build -o bin/api cmd/api/main.go

# Build for Lambda (ARM64)
GOOS=linux GOARCH=arm64 go build -o bootstrap cmd/api/main.go
zip api-lambda.zip bootstrap
```

### Environment Variables

```bash
export AWS_REGION=us-east-1
export DYNAMODB_TABLE_PREFIX=photographer-gallery
export S3_BUCKET_ORIGINAL=photographer-gallery-originals-dev
export S3_BUCKET_OPTIMIZED=photographer-gallery-optimized-dev
export S3_BUCKET_THUMBNAIL=photographer-gallery-thumbnails-dev
export COGNITO_USER_POOL_ID=us-east-1_xxxxx
export COGNITO_CLIENT_ID=xxxxx
export API_STAGE=dev
```

## Deployment

The backend is deployed as Lambda functions using AWS CDK. See the infrastructure directory for deployment scripts.

```bash
cd ../infrastructure
npm run deploy
```

## API Endpoints

### Photographer Endpoints (Requires JWT)

```
POST   /api/v1/galleries                          # Create gallery
GET    /api/v1/galleries                          # List galleries
GET    /api/v1/galleries/{id}                     # Get gallery
PUT    /api/v1/galleries/{id}                     # Update gallery
DELETE /api/v1/galleries/{id}                     # Delete gallery
POST   /api/v1/galleries/{id}/expire              # Set expiration
POST   /api/v1/galleries/{id}/photos/upload-url   # Get upload URL
GET    /api/v1/galleries/{id}/photos              # List photos
DELETE /api/v1/galleries/{id}/photos/{photoId}    # Delete photo
GET    /api/v1/galleries/{id}/favorites           # Get favorites
```

### Client Endpoints (Session Token)

```
POST   /api/v1/client/verify                      # Verify password
GET    /api/v1/client/galleries/{customUrl}       # Get gallery
GET    /api/v1/client/galleries/{customUrl}/photos # List photos
GET    /api/v1/client/photos/{photoId}/download-url # Download URL
POST   /api/v1/client/photos/{photoId}/favorite   # Toggle favorite
GET    /api/v1/client/session/favorites           # List favorites
```

## Testing

```bash
go test ./...
```

## Performance Optimizations

- **ARM64 Lambda**: 20% cost savings
- **Connection pooling**: Reuse AWS SDK clients
- **Lazy initialization**: Initialize dependencies on demand
- **Structured logging**: JSON logs for CloudWatch Logs Insights
