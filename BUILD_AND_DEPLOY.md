# Build and Deploy Guide

Complete guide for building and deploying the Photographer Gallery application to AWS.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Build](#backend-build)
3. [Frontend Build](#frontend-build)
4. [Infrastructure Deployment](#infrastructure-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Post-Deployment Configuration](#post-deployment-configuration)
7. [Verification](#verification)
8. [Updates and Redeployment](#updates-and-redeployment)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Tool | Version | Installation |
|------|---------|--------------|
| Node.js | 18+ | `brew install node` |
| Go | 1.21+ | `brew install go` |
| AWS CLI | Latest | `brew install awscli` |
| Docker Desktop | Latest | [Download](https://www.docker.com/products/docker-desktop) |
| AWS CDK CLI | Latest | `npm install -g aws-cdk` |

### AWS Account Setup

1. **Create AWS Account**: https://aws.amazon.com
2. **Configure AWS CLI**:
   ```bash
   aws configure
   ```
   Enter:
   - AWS Access Key ID (from IAM console)
   - AWS Secret Access Key
   - Default region: `us-east-1`
   - Default output format: `json`

3. **Verify Configuration**:
   ```bash
   aws sts get-caller-identity
   ```

---

## Backend Build

The backend consists of three Go Lambda functions that need to be built separately.

### Quick Build (All Lambdas)

```bash
cd /Users/jt/Code/photographer-gallery/backend

# Clean previous builds
rm -rf bin/
mkdir -p bin

# Build API Lambda
echo "Building API Lambda..."
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-api cmd/api/main.go

# Build Processor Lambda
echo "Building Processor Lambda..."
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-processor cmd/processor/main.go

# Build Scheduler Lambda
echo "Building Scheduler Lambda..."
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-scheduler cmd/scheduler/main.go

echo "✅ All Lambda functions built successfully"
```

### Build Explanation

- **GOOS=linux**: Compiles for Linux (Lambda runs on Amazon Linux)
- **GOARCH=arm64**: Compiles for ARM64 architecture (20% cheaper than x86)
- **-tags lambda.norpc**: Optimizes for Lambda runtime
- **-o bin/bootstrap-***: Output binary with Lambda bootstrap naming convention

### Verify Builds

```bash
ls -lh bin/
# Should show three bootstrap files:
# - bootstrap-api
# - bootstrap-processor
# - bootstrap-scheduler
```

**Note**: CDK will automatically zip these files during deployment, so manual zipping is not required.

---

## Frontend Build

### Development Build

For testing locally against AWS backend:

```bash
cd /Users/jt/Code/photographer-gallery/frontend

# Install dependencies (first time only)
npm install

# Start development server
npm start

# Application runs at http://localhost:4200
```

### Production Build

For deployment to S3 + CloudFront:

```bash
cd /Users/jt/Code/photographer-gallery/frontend

# Build for production
npm run build

# Output will be in: dist/photographer-gallery-frontend/browser/
```

**Build artifacts**:
- Minified JavaScript bundles
- Optimized CSS
- Compressed assets
- Service worker (if enabled)

---

## Infrastructure Deployment

### Option 1: Automated Deployment (Recommended)

Use the provided deployment script that handles everything:

```bash
cd /Users/jt/Code/photographer-gallery

# Make script executable (first time only)
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

**What the script does**:
1. ✅ Checks all prerequisites (AWS CLI, Docker, Node.js)
2. ✅ Verifies AWS credentials
3. ✅ Ensures Docker is running (required for Go builds)
4. ✅ Installs CDK dependencies
5. ✅ Bootstraps CDK (first time only)
6. ✅ Builds Go Lambda functions automatically
7. ✅ Deploys all infrastructure stacks
8. ✅ Outputs configuration values

**Deployment time**:
- First deployment: ~15-20 minutes
- Subsequent deployments: ~5-10 minutes

### Option 2: Manual Deployment (Step by Step)

#### Step 1: Prepare Infrastructure

```bash
cd /Users/jt/Code/photographer-gallery/infrastructure

# Install dependencies
npm install

# Compile TypeScript
npm run build
```

#### Step 2: Bootstrap CDK (First Time Only)

```bash
# Bootstrap CDK in your AWS account/region
npx cdk bootstrap aws://ACCOUNT-ID/us-east-1

# Or let CDK detect automatically
npx cdk bootstrap
```

**What bootstrap does**:
- Creates S3 bucket for CDK assets
- Creates IAM roles for CloudFormation
- Sets up ECR repository for Docker images (if needed)

#### Step 3: Build Backend Lambdas

**Important**: CDK requires the Lambda binaries before deployment.

```bash
cd /Users/jt/Code/photographer-gallery/backend

# Build all three Lambda functions
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-api cmd/api/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-processor cmd/processor/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-scheduler cmd/scheduler/main.go
```

#### Step 4: Deploy Stacks

```bash
cd /Users/jt/Code/photographer-gallery/infrastructure

# Preview changes (optional)
npx cdk diff

# Deploy all stacks
npx cdk deploy --all --require-approval never

# Or deploy individually
npx cdk deploy PhotographerGalleryDatabase-dev
npx cdk deploy PhotographerGalleryStorage-dev
npx cdk deploy PhotographerGalleryAuth-dev
npx cdk deploy PhotographerGalleryApi-dev
npx cdk deploy PhotographerGalleryProcessor-dev
```

#### Step 5: Save Output Values

**Critical**: CDK outputs important configuration values. Copy these immediately!

Example output:
```
Outputs:
PhotographerGalleryApi-dev.ApiUrl = https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev/
PhotographerGalleryAuth-dev.UserPoolId = us-east-1_XXXXXXXXX
PhotographerGalleryAuth-dev.UserPoolClientId = 1234567890abcdef
PhotographerGalleryAuth-dev.CognitoDomain = photographer-gallery-dev-12345
PhotographerGalleryStorage-dev.OriginalBucket = photographergallery-original-dev-abc123
PhotographerGalleryStorage-dev.CloudFrontUrl = https://d1234abcd.cloudfront.net
```

**To retrieve outputs later**:
```bash
aws cloudformation describe-stacks \
  --stack-name PhotographerGalleryApi-dev \
  --query 'Stacks[0].Outputs'
```

---

## Frontend Deployment

### Update Environment Configuration

Edit both environment files with your AWS values:

**1. Development environment** (`frontend/src/environments/environment.ts`):
```typescript
export const environment = {
  production: false,
  apiUrl: 'https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/api/v1',
  cdnUrl: 'https://YOUR-CLOUDFRONT-ID.cloudfront.net',
  cognitoUserPoolId: 'us-east-1_XXXXXXXXX',
  cognitoClientId: 'YOUR-CLIENT-ID',
  cognitoRegion: 'us-east-1',
  cognitoDomain: 'YOUR-COGNITO-DOMAIN',
};
```

**2. Production environment** (`frontend/src/environments/environment.prod.ts`):
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/api/v1',
  cdnUrl: 'https://YOUR-CLOUDFRONT-ID.cloudfront.net',
  cognitoUserPoolId: 'us-east-1_XXXXXXXXX',
  cognitoClientId: 'YOUR-CLIENT-ID',
  cognitoRegion: 'us-east-1',
  cognitoDomain: 'YOUR-COGNITO-DOMAIN',
};
```

**Note**: Both files currently point to `dev` environment. When you create a production stack, update `environment.prod.ts` accordingly.

### Build Frontend

```bash
cd /Users/jt/Code/photographer-gallery/frontend

# Production build
npm run build

# Output: dist/photographer-gallery-frontend/browser/
```

### Deploy to S3 + CloudFront

```bash
cd /Users/jt/Code/photographer-gallery/frontend

# Sync to S3 bucket (replace with your bucket name from CDK outputs)
aws s3 sync dist/photographer-gallery-frontend/browser/ s3://YOUR-FRONTEND-BUCKET-NAME/ \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

# Upload index.html separately with short cache
aws s3 cp dist/photographer-gallery-frontend/browser/index.html s3://YOUR-FRONTEND-BUCKET-NAME/index.html \
  --cache-control "public, max-age=0, must-revalidate"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR-DISTRIBUTION-ID \
  --paths "/*"
```

---

## Post-Deployment Configuration

### 1. Configure Cognito User Pool

#### Add Callback URLs

1. Open AWS Console: https://console.aws.amazon.com/cognito/
2. Select your user pool: `photographer-gallery-users-dev`
3. Go to **App integration** tab
4. Click your app client
5. Click **Edit** under Hosted UI
6. Add **Allowed callback URLs**:
   ```
   http://localhost:4200/auth/callback
   https://YOUR-CLOUDFRONT-DOMAIN/auth/callback
   https://YOUR-CUSTOM-DOMAIN/auth/callback
   ```
7. Add **Allowed sign-out URLs**:
   ```
   http://localhost:4200
   https://YOUR-CLOUDFRONT-DOMAIN
   https://YOUR-CUSTOM-DOMAIN
   ```
8. Click **Save changes**

#### Enable Social Identity Providers (Optional)

**Google OAuth**:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI: `https://YOUR-COGNITO-DOMAIN.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
4. Copy Client ID and Secret
5. In Cognito → Identity providers → Google → Enter credentials

**Facebook OAuth**:
1. Go to https://developers.facebook.com/apps
2. Create app → Consumer → Facebook Login
3. Copy App ID and App Secret
4. In Cognito → Identity providers → Facebook → Enter credentials

**Apple OAuth**:
1. Go to https://developer.apple.com/account/
2. Register Services ID
3. Configure Sign in with Apple
4. In Cognito → Identity providers → Apple → Enter credentials

### 2. Configure S3 Bucket Policies

Ensure your S3 buckets have correct permissions:

```bash
# Check bucket policies
aws s3api get-bucket-policy --bucket YOUR-BUCKET-NAME

# CloudFront should have read access to frontend bucket
# Lambda should have read/write access to photo buckets
```

### 3. Configure CloudWatch Alarms (Recommended)

Set up alarms for:
- Lambda errors
- API Gateway 5xx errors
- DynamoDB throttling
- S3 storage usage

---

## Verification

### 1. Test Backend Health

```bash
# Test API health endpoint
curl https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/api/v1/health

# Expected response: {"status":"healthy"}
```

### 2. Verify AWS Resources

```bash
# List DynamoDB tables
aws dynamodb list-tables

# Expected tables:
# - photographer-gallery-galleries-dev
# - photographer-gallery-photos-dev
# - photographer-gallery-favorites-dev
# - photographer-gallery-sessions-dev

# List S3 buckets
aws s3 ls

# Expected buckets:
# - photographergallery-original-dev-*
# - photographergallery-optimized-dev-*
# - photographergallery-thumbnail-dev-*

# List Lambda functions
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `PhotographerGallery`)].FunctionName'

# Expected functions:
# - PhotographerGalleryApi-dev-ApiHandler
# - PhotographerGalleryProcessor-dev-ProcessorHandler
# - PhotographerGalleryScheduler-dev-SchedulerHandler
```

### 3. Test Frontend Locally

```bash
cd /Users/jt/Code/photographer-gallery/frontend

# Start development server
npm start

# Open http://localhost:4200
# Test login flow
# Test gallery creation
# Test photo upload
```

### 4. Check Lambda Logs

```bash
# Tail API Lambda logs
aws logs tail /aws/lambda/PhotographerGalleryApi-dev-ApiHandler --follow

# Tail Processor Lambda logs
aws logs tail /aws/lambda/PhotographerGalleryProcessor-dev-ProcessorHandler --follow

# Check for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/PhotographerGalleryApi-dev-ApiHandler \
  --filter-pattern "ERROR"
```

---

## Updates and Redeployment

### Backend Code Updates

When you modify Go code:

```bash
# 1. Rebuild Lambda binaries
cd /Users/jt/Code/photographer-gallery/backend
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-api cmd/api/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-processor cmd/processor/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-scheduler cmd/scheduler/main.go

# 2. Redeploy infrastructure
cd /Users/jt/Code/photographer-gallery/infrastructure
npx cdk deploy --all

# Or just deploy the API stack if only API changed
npx cdk deploy PhotographerGalleryApi-dev
```

### Frontend Code Updates

When you modify frontend code:

```bash
# 1. Rebuild frontend
cd /Users/jt/Code/photographer-gallery/frontend
npm run build

# 2. Deploy to S3
aws s3 sync dist/photographer-gallery-frontend/browser/ s3://YOUR-FRONTEND-BUCKET/ --delete

# 3. Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR-DIST-ID --paths "/*"
```

### Infrastructure Updates

When you modify CDK code:

```bash
cd /Users/jt/Code/photographer-gallery/infrastructure

# 1. Review changes
npx cdk diff

# 2. Deploy changes
npx cdk deploy --all
```

### Quick Redeploy Script

Create a helper script for fast redeployment:

```bash
#!/bin/bash
# redeploy.sh

set -e

echo "🔨 Building backend..."
cd backend
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-api cmd/api/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-processor cmd/processor/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-scheduler cmd/scheduler/main.go

echo "📦 Deploying infrastructure..."
cd ../infrastructure
npx cdk deploy --all --require-approval never

echo "✅ Redeployment complete!"
```

---

## Troubleshooting

### Build Errors

**Error**: `GOOS: command not found`
- **Solution**: You're not using bash/zsh. Run: `export GOOS=linux GOARCH=arm64` first

**Error**: `package X is not in GOROOT`
- **Solution**: Run `go mod download` in backend directory

**Error**: `npm: command not found`
- **Solution**: Install Node.js: `brew install node`

### CDK Deployment Errors

**Error**: `Need to perform AWS calls but no credentials found`
- **Solution**: Run `aws configure` and enter your credentials

**Error**: `Unable to resolve AWS account`
- **Solution**: Check credentials: `aws sts get-caller-identity`

**Error**: `This stack uses assets, so the toolkit stack must be deployed`
- **Solution**: Run `npx cdk bootstrap`

**Error**: `Docker is not running`
- **Solution**: Start Docker Desktop application

**Error**: `Lambda code must be a .zip file`
- **Solution**: Rebuild Lambda binaries (ensure they're in `backend/bin/`)

### Lambda Runtime Errors

**Error**: Function returns 502 Bad Gateway
- **Check logs**: `aws logs tail /aws/lambda/FUNCTION-NAME --follow`
- **Common causes**:
  - Missing environment variables
  - DynamoDB table not found
  - S3 bucket permissions
  - Code panic/crash

**Error**: Function timeout
- **Solution**: Increase timeout in CDK stack (currently 30s for API, 5min for processor)
- **Check**: Large photo processing might need more time

### Frontend Build Errors

**Error**: `Cannot find module '@angular/core'`
- **Solution**: Run `npm install` in frontend directory

**Error**: `Environment file not found`
- **Solution**: Ensure both `environment.ts` and `environment.prod.ts` exist

### Cognito Authentication Errors

**Error**: `redirect_uri_mismatch`
- **Solution**: Add correct callback URL in Cognito console

**Error**: `invalid_grant`
- **Solution**: Check Cognito domain and client ID in environment files

**Error**: CORS error when calling API
- **Solution**: API Gateway should have CORS enabled (check CDK configuration)

### S3 / CloudFront Issues

**Error**: 403 Forbidden on S3
- **Solution**: Check bucket policy allows CloudFront access

**Error**: Old content showing after deployment
- **Solution**: Invalidate CloudFront cache:
  ```bash
  aws cloudfront create-invalidation --distribution-id YOUR-ID --paths "/*"
  ```

### Cost Monitoring

**Unexpected charges**:
```bash
# Check current month costs
aws ce get-cost-and-usage \
  --time-period Start=2025-12-01,End=2025-12-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE

# Set up billing alerts in AWS Console
```

---

## Clean Up

### Destroy All Resources

```bash
cd /Users/jt/Code/photographer-gallery/infrastructure

# Destroy all stacks
npx cdk destroy --all
```

### Manual Cleanup (if needed)

Some resources might need manual deletion:

1. **Empty S3 buckets first**:
   ```bash
   aws s3 rm s3://BUCKET-NAME --recursive
   ```

2. **Delete CloudWatch log groups**:
   ```bash
   aws logs delete-log-group --log-group-name /aws/lambda/FUNCTION-NAME
   ```

3. **Check for lingering resources**:
   ```bash
   aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
   ```

---

## Environment Files Explained

**Why does `environment.prod.ts` exist if we haven't gone to production?**

Angular's build system requires `environment.prod.ts` to exist when building for production mode (even for dev/staging):

```bash
# This command uses environment.prod.ts
npm run build
```

The `production: true` flag tells Angular to:
- Enable production optimizations (minification, tree-shaking)
- Disable development warnings
- Use AOT compilation

**Current setup**:
- `environment.ts` - Used during `npm start` (development server)
- `environment.prod.ts` - Used during `npm run build` (optimized build)
- Both currently point to the same `dev` backend

**Future production setup**:
1. Deploy separate production infrastructure: `cdk deploy --all --context stage=prod`
2. Update `environment.prod.ts` with production URLs
3. Keep `environment.ts` pointing to dev for local development

---

## Summary Checklist

**Initial Deployment**:
- [ ] AWS CLI configured
- [ ] Docker Desktop running
- [ ] Backend Lambdas built
- [ ] CDK bootstrapped
- [ ] Infrastructure deployed
- [ ] Outputs saved
- [ ] Cognito configured
- [ ] Frontend environment files updated
- [ ] Frontend built and tested

**Redeployment**:
- [ ] Backend rebuilt (if code changed)
- [ ] Infrastructure redeployed
- [ ] Frontend rebuilt (if code changed)
- [ ] CloudFront cache invalidated (if frontend changed)

---

For more detailed AWS-specific guidance, see:
- [AWS_DEPLOYMENT_QUICK_START.md](AWS_DEPLOYMENT_QUICK_START.md) - Fast deployment guide
- [DEPLOY_TO_AWS.md](DEPLOY_TO_AWS.md) - Comprehensive AWS setup

For application architecture and features, see:
- [README.md](README.md) - Project overview
- Backend README: [backend/README.md](backend/README.md)
- Frontend README: [frontend/README.md](frontend/README.md)
