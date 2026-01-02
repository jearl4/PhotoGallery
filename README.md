# Photographer Gallery Application

A modern, cost-optimized photo gallery platform for photographers to share their work with clients through secure, password-protected galleries with optional watermarking.

## Features

- **Photographer Portal**
  - Social authentication (Google, Facebook, Apple via Cognito)
  - Upload and manage photos with direct S3 uploads
  - Create private client galleries with custom URLs
  - Set gallery expiration dates
  - Optional watermarking (custom text and positioning)
  - Automatic image optimization and thumbnail generation
  - View client favorites and download analytics
  - Track gallery access and photo views

- **Client Portal**
  - Password-protected gallery access
  - View-only photo browsing with lightbox
  - Download original or optimized photos
  - Mark favorite photos
  - Filter by favorites
  - Responsive, photo-focused design

- **Image Processing**
  - Automatic thumbnail generation (200x200 with smart cropping)
  - Optimized versions (max 1920x1080) for web viewing
  - Optional watermarking with configurable position
  - EXIF metadata extraction (camera, date, GPS, settings)
  - SQS-based async processing pipeline
  - Retry logic with DLQ for failed processing

## Architecture

### Tech Stack
- **Frontend**: Angular 18+ with TypeScript and Signals
- **Backend**: Golang with Lambda functions (ARM64)
- **Infrastructure**: AWS CDK (TypeScript)
- **Database**: DynamoDB with GSIs
- **Storage**: S3 with Intelligent-Tiering (3 buckets: original, optimized, thumbnail)
- **CDN**: CloudFront for global photo delivery
- **Auth**: Cognito with social identity providers
- **Processing**: SQS + Lambda for async image processing

### AWS Services
- **S3**: Three buckets (originals, optimized, thumbnails)
- **CloudFront**: Global CDN for photo delivery
- **DynamoDB**: NoSQL database with on-demand billing
- **Cognito**: User authentication
- **Lambda**: Serverless compute (Golang ARM64)
- **API Gateway**: REST API
- **EventBridge**: Scheduled tasks
- **SQS**: Async photo processing queue

### Cost Optimization
- S3 Intelligent-Tiering for automatic cost savings
- Lifecycle policies moving old photos to Glacier
- CloudFront caching (24hr+) to reduce S3 requests
- WebP/AVIF image compression (70% size reduction)
- Lambda ARM64 architecture (20% cheaper)
- DynamoDB on-demand billing
- **Estimated cost**: $120-270/month for 1000 galleries, 50k photos

## Project Structure

```
photographer-gallery/
├── backend/                 # Golang Lambda functions
│   ├── cmd/                # Lambda handlers
│   ├── internal/           # Business logic
│   │   ├── api/           # HTTP handlers
│   │   ├── domain/        # Domain models
│   │   ├── repository/    # Data access
│   │   └── services/      # External services
│   └── pkg/               # Shared packages
├── frontend/               # Angular application
│   └── src/app/
│       ├── core/          # Core services
│       ├── features/      # Feature modules
│       └── shared/        # Shared components
└── infrastructure/         # AWS CDK stacks
    └── lib/stacks/        # CloudFormation stacks
```

## Quick Start

### Prerequisites
- Node.js 18+
- Go 1.21+
- Docker Desktop (running)
- AWS CLI configured
- AWS CDK CLI (`npm install -g aws-cdk`)

### Fast Deployment to AWS

```bash
# Make deploy script executable
chmod +x deploy.sh

# Deploy everything (infrastructure + backend)
./deploy.sh
```

The script will:
1. Check prerequisites
2. Build Go Lambda functions automatically
3. Deploy all AWS infrastructure
4. Output configuration values

See [BUILD_AND_DEPLOY.md](BUILD_AND_DEPLOY.md) for complete deployment documentation.

### Local Development

**Frontend Development** (local dev server):
```bash
cd frontend
npm install
npm start
# Open http://localhost:4200
```

**Backend Development** (Lambda local testing):
```bash
cd backend
go mod download

# Build for Lambda
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-api cmd/api/main.go

# Test locally with SAM or Lambda emulator
```

## Database Schema

### DynamoDB Tables

**Photographers**
- PK: `USER#{userId}`
- SK: `METADATA`
- GSI: EmailIndex

**Galleries**
- PK: `galleryId`
- Attributes: name, description, customUrl, password, photoCount, totalSize, enableWatermark, watermarkText, watermarkPosition, expiresAt, status
- GSI1: PhotographerIndex (photographerId)
- GSI2: CustomUrlIndex (customUrl)
- GSI3: StatusExpirationIndex (status, expiresAt)

**Photos**
- PK: `photoId`
- Attributes: galleryId, fileName, originalKey, optimizedKey, thumbnailKey, width, height, size, metadata (EXIF), processingStatus
- GSI1: GalleryIndex (galleryId)

**Favorites**
- PK: `GALLERY#{galleryId}#SESSION#{sessionId}`
- SK: `PHOTO#{photoId}`
- GSI1: PhotoSessionIndex

**ClientSessions**
- PK: `GALLERY#{galleryId}`
- SK: `SESSION#{sessionId}`
- TTL: Enabled for auto-cleanup

## API Endpoints

### Photographer Endpoints (JWT Required)
```
POST   /api/v1/galleries                          # Create gallery
GET    /api/v1/galleries                          # List galleries
GET    /api/v1/galleries/{id}                     # Gallery details
PUT    /api/v1/galleries/{id}                     # Update gallery
DELETE /api/v1/galleries/{id}                     # Delete gallery
POST   /api/v1/galleries/{id}/photos/upload-url   # Get upload URL
GET    /api/v1/galleries/{id}/photos              # List photos
DELETE /api/v1/galleries/{id}/photos/{photoId}    # Delete photo
```

### Client Endpoints (Session Token Required)
```
POST   /api/v1/client/verify                      # Verify password
GET    /api/v1/client/galleries/{customUrl}       # Gallery info
GET    /api/v1/client/galleries/{customUrl}/photos # List photos
GET    /api/v1/client/photos/{photoId}/download-url # Get download URL
POST   /api/v1/client/photos/{photoId}/favorite   # Toggle favorite
```

## Development Status

### ✅ Completed Features

- [x] Infrastructure setup with AWS CDK
- [x] DynamoDB database design and repositories
- [x] Cognito authentication with social providers
- [x] Gallery management (create, read, update, delete)
- [x] Photo upload with presigned S3 URLs
- [x] Async photo processing pipeline (SQS + Lambda)
- [x] Automatic thumbnail and optimized image generation
- [x] EXIF metadata extraction
- [x] Optional watermarking with custom text and position
- [x] Photo viewing with lightbox and filters
- [x] Favorites system for clients
- [x] Photo download tracking
- [x] Gallery expiration scheduling
- [x] CloudFront CDN for global delivery
- [x] Frontend with Angular 18 (standalone components, signals)
- [x] Comprehensive test coverage (250+ tests)
- [x] Deployment automation with `deploy.sh` script

### 🚧 In Progress / Planned

- [ ] Advanced image optimizations (WebP/AVIF support when pure Go libraries available)
- [ ] Enhanced watermark customization (font selection, size, opacity)
- [ ] Batch photo operations
- [ ] Gallery templates and themes
- [ ] Advanced analytics and reporting
- [ ] Email notifications for clients
- [ ] Custom domain support for galleries
- [ ] Mobile app (React Native)

## Documentation

- [BUILD_AND_DEPLOY.md](BUILD_AND_DEPLOY.md) - Complete build and deployment guide
- [AWS_DEPLOYMENT_QUICK_START.md](AWS_DEPLOYMENT_QUICK_START.md) - Quick AWS deployment
- [DEPLOY_TO_AWS.md](DEPLOY_TO_AWS.md) - Detailed AWS setup instructions
- [backend/README.md](backend/README.md) - Backend architecture and API docs
- [frontend/README.md](frontend/README.md) - Frontend development guide

## License

MIT
