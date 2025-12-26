# Photographer Gallery Application

A modern, cost-optimized photo gallery platform for photographers to share their work with clients through secure, password-protected galleries.

## Features

- **Photographer Portal**
  - Social authentication (Google, Facebook, Apple)
  - Upload and manage photos
  - Create private client galleries with custom URLs
  - Set gallery expiration dates
  - View client favorites and analytics

- **Client Portal**
  - Password-protected gallery access
  - View-only photo browsing
  - Download photos
  - Mark favorite photos
  - Responsive, photo-focused design

## Architecture

### Tech Stack
- **Frontend**: Angular 18+ with TypeScript
- **Backend**: Golang with Lambda functions
- **Infrastructure**: AWS CDK (TypeScript)
- **Database**: DynamoDB with GSIs
- **Storage**: S3 with Intelligent-Tiering
- **CDN**: CloudFront with signed URLs
- **Auth**: Cognito with social providers

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

## Getting Started

### Prerequisites
- Node.js 18+
- Go 1.21+
- AWS CLI configured
- AWS CDK CLI (`npm install -g aws-cdk`)

### Backend Development
```bash
cd backend
go mod download
go run cmd/api/main.go
```

### Frontend Development
```bash
cd frontend
npm install
ng serve
```

### Infrastructure Deployment
```bash
cd infrastructure
npm install
npm run build

# Configure your OAuth providers
export GOOGLE_CLIENT_ID=your-google-client-id
export GOOGLE_CLIENT_SECRET=your-google-secret
export FACEBOOK_APP_ID=your-facebook-app-id
export FACEBOOK_APP_SECRET=your-facebook-secret
export APPLE_SERVICES_ID=your-apple-services-id
export APPLE_TEAM_ID=your-apple-team-id
export APPLE_KEY_ID=your-apple-key-id
export APPLE_PRIVATE_KEY=your-apple-private-key

# Deploy to AWS
cdk deploy --all --context stage=dev
```

## Database Schema

### DynamoDB Tables

**Photographers**
- PK: `USER#{userId}`
- SK: `METADATA`
- GSI: EmailIndex

**Galleries**
- PK: `PHOTOGRAPHER#{userId}`
- SK: `GALLERY#{galleryId}`
- GSI1: GalleryIdIndex
- GSI2: CustomUrlIndex
- GSI3: StatusExpirationIndex

**Photos**
- PK: `GALLERY#{galleryId}`
- SK: `PHOTO#{photoId}`
- GSI1: PhotoIdIndex

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

## Development Roadmap

- [x] Phase 1: Project foundation & infrastructure setup
- [ ] Phase 2: Backend core services (repository, domain logic)
- [ ] Phase 3: Authentication (Cognito integration)
- [ ] Phase 4: Gallery management (CRUD operations)
- [ ] Phase 5: Photo upload & processing pipeline
- [ ] Phase 6: Photo viewing & downloads
- [ ] Phase 7: Favorites system
- [ ] Phase 8: Gallery expiration & lifecycle
- [ ] Phase 9: Security & optimization
- [ ] Phase 10: Testing & deployment

## License

MIT
