# Image Processing - Current State & Implementation Plan

## 📊 Current State

### ✅ What Exists

**Infrastructure:**
- ✅ S3 buckets created (originals, optimized, thumbnails)
- ✅ CloudFront CDN configured for delivery
- ✅ Directory structure exists: `backend/cmd/processor/` and `backend/cmd/scheduler/`

**Backend Services:**
- ✅ Photo upload flow works (presigned URLs)
- ✅ Photos upload to `photographer-gallery-originals-dev-*` bucket
- ✅ Photo metadata saves to DynamoDB
- ✅ S3 service generates presigned URLs for upload/download

**Frontend:**
- ✅ Photo upload UI exists
- ✅ File selection and upload to S3 works

### ❌ What's Missing

**Image Processing (CRITICAL):**
- ❌ No Lambda function to process images
- ❌ No thumbnail generation (200x200)
- ❌ No optimized version generation (1920x1080 max)
- ❌ No WebP/AVIF conversion for smaller file sizes
- ❌ No EXIF metadata extraction (camera, date, GPS, etc.)
- ❌ No S3 event trigger to start processing
- ❌ No EventBridge/SQS queue for async processing

**Infrastructure:**
- ❌ No processing-stack.ts in CDK
- ❌ No S3 event notifications configured
- ❌ Processing directories are empty

**Impact:**
- Photos are uploaded but NOT processed
- Users see original huge files (slow loading)
- No thumbnails (bad UX)
- No optimization (high bandwidth costs)
- Missing metadata (can't search/filter by camera, date, etc.)

---

## 🎯 Image Processing Pipeline Design

### Architecture Flow

```
1. User uploads photo via frontend
   ↓
2. Frontend gets presigned URL from API
   ↓
3. Frontend uploads directly to S3 (originals bucket)
   ↓
4. S3 triggers EventBridge notification
   ↓
5. EventBridge sends message to SQS queue
   ↓
6. SQS triggers Processing Lambda
   ↓
7. Lambda downloads original from S3
   ↓
8. Lambda processes image:
   - Generate thumbnail (200x200) → thumbnails bucket
   - Generate optimized (1920x1080 max) → optimized bucket
   - Convert to WebP format (70% smaller)
   - Extract EXIF metadata
   ↓
9. Lambda updates DynamoDB with:
   - Thumbnail key
   - Optimized key
   - Metadata (dimensions, camera, date)
   - File sizes
   ↓
10. Frontend displays thumbnail (fast!)
    User clicks → loads optimized version
    Download → gets original
```

### Why This Architecture?

**S3 → EventBridge → SQS → Lambda:**
- ✅ **Decoupled**: Upload doesn't wait for processing
- ✅ **Reliable**: SQS retry if processing fails
- ✅ **Scalable**: Handles 1000s of uploads simultaneously
- ✅ **Cost-effective**: Only pay when processing
- ✅ **Error handling**: Dead letter queue for failed jobs

**Alternative (Simpler but worse):**
- API Gateway → Lambda → S3 (synchronous)
  - ❌ User waits 10-30 seconds for processing
  - ❌ API Gateway 30s timeout (large images fail)
  - ❌ No retry on failure

---

## 📝 Implementation Tasks

### Phase 1: Processing Lambda Function (Core)

#### Task 1.1: Create Image Processing Service
**File:** `backend/internal/services/image/processor.go`

**Responsibilities:**
- Resize images (thumbnail, optimized)
- Convert formats (JPEG → WebP)
- Extract EXIF metadata
- Compress images

**Dependencies:**
```go
// Use github.com/disintegration/imaging for image manipulation
// Use github.com/rwcarlsen/goexif for EXIF extraction
```

**Functions:**
```go
type ProcessingResult struct {
    ThumbnailKey  string
    OptimizedKey  string
    Width         int
    Height        int
    FileSize      int64
    CameraModel   string
    DateTaken     time.Time
    GPS           *GPSCoordinates
}

func ProcessImage(ctx context.Context, originalKey string) (*ProcessingResult, error)
func GenerateThumbnail(img image.Image, maxSize int) (image.Image, error)
func GenerateOptimized(img image.Image, maxWidth, maxHeight int) (image.Image, error)
func ConvertToWebP(img image.Image, quality int) ([]byte, error)
func ExtractEXIF(file io.Reader) (*EXIFData, error)
```

#### Task 1.2: Create Processing Lambda Handler
**File:** `backend/cmd/processor/main.go`

**Purpose:** Lambda entry point that receives S3 events

```go
package main

import (
    "context"
    "github.com/aws/aws-lambda-go/events"
    "github.com/aws/aws-lambda-go/lambda"
    // ... your services
)

type ProcessorApp struct {
    imageService *image.Service
    photoRepo    repository.PhotoRepository
    s3Service    *storage.Service
}

func (app *ProcessorApp) handleS3Event(ctx context.Context, event events.S3Event) error {
    for _, record := range event.Records {
        bucketName := record.S3.Bucket.Name
        objectKey := record.S3.Object.Key

        // Download original from S3
        // Process image (thumbnail, optimized, WebP)
        // Upload processed images to respective buckets
        // Extract EXIF metadata
        // Update DynamoDB with new keys and metadata
    }
    return nil
}

func main() {
    app := initializeApp()
    lambda.Start(app.handleS3Event)
}
```

#### Task 1.3: Add Go Dependencies
**File:** `backend/go.mod`

```bash
go get github.com/disintegration/imaging
go get github.com/rwcarlsen/goexif/exif
go get github.com/chai2010/webp
```

---

### Phase 2: Infrastructure (CDK)

#### Task 2.1: Create Processing Stack
**File:** `infrastructure/lib/stacks/processing-stack.ts`

**Resources:**
1. **SQS Queue** for processing jobs
   - Dead Letter Queue for failures
   - Visibility timeout: 5 minutes
   - Message retention: 14 days

2. **Processing Lambda Function**
   - Memory: 1024MB (image processing needs more)
   - Timeout: 5 minutes (large images take time)
   - Environment: S3 bucket names, DynamoDB table
   - Architecture: ARM64 (cost savings)

3. **S3 Event Notification**
   - Trigger: Object created in originals bucket
   - Target: EventBridge

4. **EventBridge Rule**
   - Source: S3 events
   - Target: SQS Queue

5. **IAM Permissions**
   - Lambda can read from originals bucket
   - Lambda can write to optimized/thumbnail buckets
   - Lambda can read/write DynamoDB photos table
   - Lambda can receive SQS messages

**Code Structure:**
```typescript
export class ProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProcessingStackProps) {
    // Create DLQ
    const dlq = new sqs.Queue(this, 'ProcessingDLQ', { ... });

    // Create processing queue
    const queue = new sqs.Queue(this, 'ProcessingQueue', {
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 }
    });

    // Create processor Lambda
    const processor = new lambda.Function(this, 'Processor', {
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../backend', {
        bundling: { /* compile cmd/processor/main.go */ }
      }),
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
      architecture: lambda.Architecture.ARM_64,
    });

    // Add SQS event source to Lambda
    processor.addEventSource(new SqsEventSource(queue));

    // Add EventBridge rule for S3 events
    const rule = new events.Rule(this, 'S3UploadRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: { name: [originalBucket.bucketName] }
        }
      }
    });
    rule.addTarget(new targets.SqsQueue(queue));

    // Enable EventBridge notifications on S3 bucket
    originalBucket.enableEventBridgeNotification();
  }
}
```

#### Task 2.2: Update Main CDK App
**File:** `infrastructure/bin/app.ts`

Add ProcessingStack:
```typescript
import { ProcessingStack } from '../lib/stacks/processing-stack';

const processingStack = new ProcessingStack(app, `PhotographerGalleryProcessing-${stage}`, {
  env,
  stage,
  databaseStack,
  storageStack,
});
```

---

### Phase 3: Update Photo Model & Repository

#### Task 3.1: Add Fields to Photo Model
**File:** `backend/internal/domain/photo/photo.go`

Add fields:
```go
type Photo struct {
    // ... existing fields

    // Processed image keys
    OptimizedKey  string `json:"optimizedKey" dynamodbav:"optimizedKey"`
    ThumbnailKey  string `json:"thumbnailKey" dynamodbav:"thumbnailKey"`

    // Image metadata
    Width         int       `json:"width" dynamodbav:"width"`
    Height        int       `json:"height" dynamodbav:"height"`
    FileSize      int64     `json:"fileSize" dynamodbav:"fileSize"`

    // EXIF data
    CameraModel   string    `json:"cameraModel,omitempty" dynamodbav:"cameraModel,omitempty"`
    CameraMake    string    `json:"cameraMake,omitempty" dynamodbav:"cameraMake,omitempty"`
    DateTaken     string    `json:"dateTaken,omitempty" dynamodbav:"dateTaken,omitempty"`
    ISO           int       `json:"iso,omitempty" dynamodbav:"iso,omitempty"`
    FocalLength   string    `json:"focalLength,omitempty" dynamodbav:"focalLength,omitempty"`
    Aperture      string    `json:"aperture,omitempty" dynamodbav:"aperture,omitempty"`
    ShutterSpeed  string    `json:"shutterSpeed,omitempty" dynamodbav:"shutterSpeed,omitempty"`
    GPS           *GPS      `json:"gps,omitempty" dynamodbav:"gps,omitempty"`

    // Processing status
    ProcessingStatus string `json:"processingStatus" dynamodbav:"processingStatus"` // pending, processing, completed, failed
}

type GPS struct {
    Latitude  float64 `json:"latitude" dynamodbav:"latitude"`
    Longitude float64 `json:"longitude" dynamodbav:"longitude"`
}
```

#### Task 3.2: Add Update Method to Repository
**File:** `backend/internal/repository/dynamodb/photo.go`

```go
func (r *PhotoRepository) UpdateProcessedKeys(ctx context.Context, photoID string, data ProcessedData) error {
    // Update DynamoDB item with thumbnail key, optimized key, metadata
}
```

---

### Phase 4: Frontend Updates

#### Task 4.1: Display Thumbnails Instead of Full Images
**File:** `frontend/src/app/features/photographer/photo-grid/photo-grid.component.ts`

```typescript
getPhotoThumbnailUrl(photo: Photo): string {
  // Use CloudFront + thumbnail key instead of original
  return `https://${environment.cloudFrontDomain}/thumbnails/${photo.thumbnailKey}`;
}

getPhotoOptimizedUrl(photo: Photo): string {
  return `https://${environment.cloudFrontDomain}/optimized/${photo.optimizedKey}`;
}
```

#### Task 4.2: Show Processing Status
**Component:** Photo upload component

```typescript
<div *ngIf="photo.processingStatus === 'pending'" class="processing-badge">
  <spinner></spinner> Processing...
</div>
<div *ngIf="photo.processingStatus === 'failed'" class="error-badge">
  Processing failed
</div>
```

#### Task 4.3: Add Metadata Display
**Component:** Photo detail view

```html
<div class="photo-metadata">
  <p><strong>Camera:</strong> {{ photo.cameraMake }} {{ photo.cameraModel }}</p>
  <p><strong>Date Taken:</strong> {{ photo.dateTaken | date }}</p>
  <p><strong>Settings:</strong> ISO {{ photo.iso }}, f/{{ photo.aperture }}, {{ photo.shutterSpeed }}s</p>
  <p><strong>Dimensions:</strong> {{ photo.width }} × {{ photo.height }}</p>
</div>
```

---

## ⏱️ Estimated Timeline

| Phase | Task | Time | Priority |
|-------|------|------|----------|
| 1.1 | Image processing service | 3 hours | HIGH |
| 1.2 | Processing Lambda handler | 2 hours | HIGH |
| 1.3 | Add Go dependencies | 15 min | HIGH |
| 2.1 | Create processing stack (CDK) | 2 hours | HIGH |
| 2.2 | Update main CDK app | 15 min | HIGH |
| 3.1 | Update photo model | 30 min | MEDIUM |
| 3.2 | Update repository | 1 hour | MEDIUM |
| 4.1 | Display thumbnails | 1 hour | HIGH |
| 4.2 | Show processing status | 30 min | MEDIUM |
| 4.3 | Add metadata display | 1 hour | LOW |
| **Testing** | End-to-end testing | 2 hours | HIGH |

**Total: ~13-14 hours**

**Can be done in phases:**
- **Phase 1 (6 hours)**: Core processing works
- **Phase 2 (4 hours)**: Infrastructure deployment
- **Phase 3 (4 hours)**: Polish and metadata

---

## 🚀 Quick Start Implementation Order

### Day 1 (4-5 hours): Get Basic Processing Working
1. ✅ Create `backend/internal/services/image/processor.go`
2. ✅ Create `backend/cmd/processor/main.go`
3. ✅ Add Go dependencies
4. ✅ Test locally with sample image

### Day 2 (3-4 hours): Deploy to AWS
5. ✅ Create `infrastructure/lib/stacks/processing-stack.ts`
6. ✅ Deploy processing stack
7. ✅ Test upload → S3 → Lambda trigger → processing

### Day 3 (2-3 hours): Frontend Integration
8. ✅ Update frontend to use thumbnails
9. ✅ Show processing status
10. ✅ End-to-end testing

### Day 4 (Optional - 2-3 hours): Polish
11. ✅ Add EXIF metadata extraction
12. ✅ Display metadata in UI
13. ✅ Add retry logic for failed processing

---

## 🔍 Testing Strategy

### Unit Tests
```go
// backend/internal/services/image/processor_test.go
func TestGenerateThumbnail(t *testing.T) { ... }
func TestExtractEXIF(t *testing.T) { ... }
func TestConvertToWebP(t *testing.T) { ... }
```

### Integration Tests
```go
// backend/cmd/processor/main_test.go
func TestProcessS3Event(t *testing.T) {
    // Mock S3 upload
    // Trigger Lambda
    // Verify thumbnail created
    // Verify DynamoDB updated
}
```

### Manual Testing
1. Upload photo via frontend
2. Check S3 originals bucket (should have original)
3. Wait 10-30 seconds
4. Check S3 thumbnails bucket (should have thumbnail)
5. Check S3 optimized bucket (should have optimized version)
6. Check DynamoDB photos table (should have all keys + metadata)
7. Refresh frontend (should show thumbnail)

---

## 💡 Key Technical Decisions

### Why Go for Image Processing?
- ✅ Already using Go for backend
- ✅ `imaging` library is fast and full-featured
- ✅ Low Lambda cold start time
- ✅ Efficient memory usage

### Why SQS instead of Direct Lambda?
- ✅ **Buffering**: Handles traffic spikes
- ✅ **Retry logic**: Auto-retry failed processing
- ✅ **Visibility**: See queue depth in CloudWatch
- ✅ **DLQ**: Failed messages go to dead letter queue for debugging

### Why EventBridge instead of S3 Direct Lambda?
- ✅ **Filtering**: Can filter events by prefix, size, etc.
- ✅ **Multiple targets**: Can send to SQS, SNS, Lambda, etc.
- ✅ **Monitoring**: Better CloudWatch integration

### Image Sizes
- **Thumbnail**: 200x200 (gallery grid view)
- **Optimized**: 1920x1080 max (detail view, download)
- **Original**: Unchanged (backup, pro downloads)

### File Formats
- **Input**: JPEG, PNG, HEIC
- **Output**: WebP (70-90% smaller than JPEG)
- **Fallback**: Keep JPEG for compatibility

---

## 📊 Expected Performance

### Processing Time (per photo)
- Small (< 1MB): ~2-5 seconds
- Medium (1-5MB): ~5-15 seconds
- Large (5-20MB): ~15-30 seconds
- Huge (> 20MB): ~30-60 seconds

### Cost (per 1000 photos processed)
- Lambda (1024MB, 30s avg): ~$0.50
- S3 storage (3 versions per photo): ~$0.10/month
- Data transfer: ~$0.20
- **Total: ~$0.70 per 1000 photos**

### Storage Savings (WebP vs JPEG)
- Original JPEG: 5MB avg
- Optimized WebP: 1.5MB (70% smaller)
- Thumbnail WebP: 50KB
- **Total for 1000 photos**: 5GB → 1.5GB (saves $0.10/month)

---

## 🎯 Success Criteria

- [ ] User uploads photo → thumbnail appears within 30 seconds
- [ ] Thumbnail loads in < 500ms (small file size)
- [ ] Optimized version is < 2MB (fast detail view)
- [ ] Original is preserved unchanged
- [ ] EXIF metadata extracted and displayed
- [ ] Failed processing goes to DLQ
- [ ] Processing errors logged to CloudWatch
- [ ] Can process 100 uploads simultaneously

---

## 🐛 Common Issues & Solutions

### Issue: Lambda timeout processing large images
**Solution**: Increase memory (more CPU) and timeout to 5 minutes

### Issue: Out of memory in Lambda
**Solution**: Increase memory to 1536MB or 2048MB

### Issue: S3 events not triggering Lambda
**Solution**: Check EventBridge rule, SQS permissions

### Issue: Images corrupted after processing
**Solution**: Verify MIME types, encoding, WebP quality settings

### Issue: EXIF data not found
**Solution**: Some photos don't have EXIF (screenshots, edited), handle gracefully

---

## 🔗 Useful Resources

- [Go imaging library](https://github.com/disintegration/imaging)
- [Go EXIF extraction](https://github.com/rwcarlsen/goexif)
- [WebP encoding in Go](https://github.com/chai2010/webp)
- [AWS Lambda Go](https://docs.aws.amazon.com/lambda/latest/dg/lambda-golang.html)
- [S3 Event Notifications](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventBridge.html)
- [CDK SQS](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_sqs-readme.html)
