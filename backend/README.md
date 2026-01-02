# Photographer Gallery Backend

Go-based serverless backend for the photographer gallery application.

## Architecture

### Lambda Functions
1. **API Handler** (`cmd/api/main.go`) - REST API for photographers and clients
2. **Processor** (`cmd/processor/main.go`) - Async photo processing (thumbnails, optimization, watermarks, EXIF)
3. **Scheduler** (`cmd/scheduler/main.go`) - Gallery expiration and cleanup tasks

### AWS Services
- **Lambda**: Serverless compute (ARM64 for 20% cost savings)
- **DynamoDB**: NoSQL database for galleries, photos, favorites, sessions
- **S3**: Three buckets for original, optimized, and thumbnail photos
- **SQS**: Async processing queue with DLQ for failed processing retries
- **API Gateway**: REST API endpoint with Cognito authorization
- **CloudFront**: CDN for global photo delivery
- **EventBridge**: Scheduled tasks for gallery cleanup

### Key Features
- ARM64 Lambda architecture for cost optimization
- Async image processing pipeline with SQS
- EXIF metadata extraction (camera, date, GPS, settings)
- Optional watermarking with custom text and positioning
- Presigned S3 URLs for direct client-side uploads
- Session-based client authentication (no account required)
- Photo download and favorite tracking
- Gallery expiration management with automatic cleanup

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

**Build all Lambda functions**:
```bash
# Clean previous builds
rm -rf bin/
mkdir -p bin

# Build API Lambda
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-api cmd/api/main.go

# Build Processor Lambda
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-processor cmd/processor/main.go

# Build Scheduler Lambda
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-scheduler cmd/scheduler/main.go
```

**Note**: CDK automatically zips these binaries during deployment, so manual zipping is not required.

**Quick rebuild script** (`rebuild.sh`):
```bash
#!/bin/bash
set -e
mkdir -p bin
echo "Building API Lambda..."
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-api cmd/api/main.go
echo "Building Processor Lambda..."
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-processor cmd/processor/main.go
echo "Building Scheduler Lambda..."
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-scheduler cmd/scheduler/main.go
echo "✅ All Lambda functions built"
```

### Environment Variables

**API Lambda**:
```bash
export AWS_REGION_NAME=us-east-1
export DYNAMODB_TABLE_PREFIX=photographer-gallery
export S3_BUCKET_ORIGINAL=photographer-gallery-originals-dev
export S3_BUCKET_OPTIMIZED=photographer-gallery-optimized-dev
export S3_BUCKET_THUMBNAIL=photographer-gallery-thumbnails-dev
export COGNITO_USER_POOL_ID=us-east-1_xxxxx
export COGNITO_CLIENT_ID=xxxxx
export STAGE=dev
```

**Processor Lambda**:
```bash
export AWS_REGION_NAME=us-east-1
export DYNAMODB_TABLE_PREFIX=photographer-gallery
export S3_BUCKET_ORIGINAL=photographer-gallery-originals-dev
export S3_BUCKET_OPTIMIZED=photographer-gallery-optimized-dev
export S3_BUCKET_THUMBNAIL=photographer-gallery-thumbnails-dev
export STAGE=dev
```

**Scheduler Lambda**:
```bash
export AWS_REGION_NAME=us-east-1
export DYNAMODB_TABLE_PREFIX=photographer-gallery
export STAGE=dev
```

## Deployment

The backend is deployed as Lambda functions using AWS CDK.

**Quick deployment**:
```bash
cd /Users/jt/Code/photographer-gallery
./deploy.sh
```

**Manual deployment**:
```bash
# 1. Build Lambda functions
cd backend
rm -rf bin/ && mkdir -p bin
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-api cmd/api/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-processor cmd/processor/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-scheduler cmd/scheduler/main.go

# 2. Deploy infrastructure
cd ../infrastructure
npx cdk deploy --all
```

See [BUILD_AND_DEPLOY.md](../BUILD_AND_DEPLOY.md) for complete deployment documentation.

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
