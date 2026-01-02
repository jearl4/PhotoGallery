# Photographer Gallery Infrastructure

AWS CDK infrastructure for the photographer gallery application.

## Overview

This directory contains TypeScript CDK code that deploys all AWS resources needed for the photographer gallery application.

## Stack Architecture

The infrastructure is organized into multiple CDK stacks:

### 1. Database Stack (`PhotographerGalleryDatabase-{stage}`)
- **DynamoDB Tables**:
  - `galleries` - Gallery metadata with watermark settings
  - `photos` - Photo metadata with processing status
  - `favorites` - Client photo favorites
  - `sessions` - Client session tokens (with TTL)

### 2. Storage Stack (`PhotographerGalleryStorage-{stage}`)
- **S3 Buckets**:
  - `original` - Original uploaded photos
  - `optimized` - Optimized photos (max 1920x1080) with optional watermarks
  - `thumbnail` - Thumbnail photos (200x200)
  - Frontend hosting bucket
- **CloudFront Distribution**: CDN for global photo delivery

### 3. Auth Stack (`PhotographerGalleryAuth-{stage}`)
- **Cognito User Pool**: Photographer authentication
- **Cognito App Client**: OAuth 2.0 client
- **Cognito Domain**: Hosted UI domain
- **Identity Providers**: Google, Facebook, Apple (configurable)

### 4. API Stack (`PhotographerGalleryApi-{stage}`)
- **API Gateway**: REST API with Cognito authorization
- **Lambda Function**: API handler (ARM64)
- **Environment Variables**: Auto-configured from other stacks

### 5. Processor Stack (`PhotographerGalleryProcessor-{stage}`)
- **SQS Queue**: Photo processing queue
- **SQS DLQ**: Dead letter queue for failed processing
- **Lambda Function**: Processor handler (ARM64)
- **S3 Event Notifications**: Trigger processing on upload

### 6. Scheduler Stack (`PhotographerGalleryScheduler-{stage}`)
- **EventBridge Rule**: Scheduled gallery cleanup (daily)
- **Lambda Function**: Scheduler handler (ARM64)

## Prerequisites

- Node.js 18+
- AWS CLI configured
- AWS CDK CLI: `npm install -g aws-cdk`
- Docker Desktop running (for Go Lambda builds)
- Go 1.21+ (for building Lambda functions)

## Deployment

### Quick Deployment

Use the automated deployment script from the project root:

```bash
cd /Users/jt/Code/photographer-gallery
./deploy.sh
```

### Manual Deployment

#### 1. Install Dependencies

```bash
cd infrastructure
npm install
```

#### 2. Build Lambda Functions

CDK requires the Lambda binaries to exist before deployment:

```bash
cd ../backend
mkdir -p bin

# Build all three Lambda functions
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-api cmd/api/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-processor cmd/processor/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-scheduler cmd/scheduler/main.go

cd ../infrastructure
```

#### 3. Bootstrap CDK (First Time Only)

```bash
npx cdk bootstrap
```

This creates:
- S3 bucket for CDK assets
- IAM roles for CloudFormation
- ECR repository (if needed)

#### 4. Review Changes (Optional)

```bash
# See what will be deployed
npx cdk diff

# Synthesize CloudFormation templates
npx cdk synth
```

#### 5. Deploy All Stacks

```bash
# Deploy everything
npx cdk deploy --all --require-approval never

# Or deploy individually
npx cdk deploy PhotographerGalleryDatabase-dev
npx cdk deploy PhotographerGalleryStorage-dev
npx cdk deploy PhotographerGalleryAuth-dev
npx cdk deploy PhotographerGalleryApi-dev
npx cdk deploy PhotographerGalleryProcessor-dev
npx cdk deploy PhotographerGalleryScheduler-dev
```

**Deployment time**: 10-15 minutes (first time)

#### 6. Save Outputs

CDK will output important configuration values:

```
Outputs:
PhotographerGalleryApi-dev.ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com/dev/
PhotographerGalleryAuth-dev.UserPoolId = us-east-1_XXXXXXXXX
PhotographerGalleryAuth-dev.UserPoolClientId = 1234567890abcdef
PhotographerGalleryAuth-dev.CognitoDomain = photographer-gallery-dev-xxxxx
PhotographerGalleryStorage-dev.CloudFrontUrl = https://d1234.cloudfront.net
```

**Save these values** - you'll need them for frontend configuration.

Retrieve outputs later:
```bash
aws cloudformation describe-stacks \
  --stack-name PhotographerGalleryApi-dev \
  --query 'Stacks[0].Outputs'
```

## Configuration

### Environment Stages

Deploy to different stages using the `stage` context:

```bash
# Development
npx cdk deploy --all --context stage=dev

# Staging
npx cdk deploy --all --context stage=staging

# Production
npx cdk deploy --all --context stage=prod
```

Each stage gets separate:
- DynamoDB tables
- S3 buckets
- Lambda functions
- API Gateway endpoints
- Cognito user pools

### Social Identity Providers

Configure OAuth providers by setting environment variables or updating CDK code:

**Google OAuth**:
1. Create OAuth 2.0 Client at https://console.cloud.google.com/apis/credentials
2. Set redirect URI: `https://YOUR-COGNITO-DOMAIN.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
3. Add Client ID and Secret to Cognito (via AWS Console or CDK)

**Facebook OAuth**:
1. Create app at https://developers.facebook.com/apps
2. Get App ID and App Secret
3. Add to Cognito

**Apple OAuth**:
1. Register Services ID at https://developer.apple.com/account/
2. Configure Sign in with Apple
3. Add to Cognito

## CDK Commands

```bash
# List all stacks
npx cdk list

# Show differences between deployed and local
npx cdk diff

# Synthesize CloudFormation templates
npx cdk synth

# Deploy specific stack
npx cdk deploy PhotographerGalleryApi-dev

# Deploy all stacks
npx cdk deploy --all

# Destroy specific stack
npx cdk destroy PhotographerGalleryApi-dev

# Destroy all stacks
npx cdk destroy --all

# Watch mode (auto-deploy on changes)
npx cdk watch
```

## Project Structure

```
infrastructure/
├── bin/
│   └── app.ts                 # CDK app entry point
├── lib/
│   └── stacks/
│       ├── database-stack.ts  # DynamoDB tables
│       ├── storage-stack.ts   # S3 buckets + CloudFront
│       ├── auth-stack.ts      # Cognito user pool
│       ├── api-stack.ts       # API Gateway + Lambda
│       ├── processor-stack.ts # Photo processing
│       └── scheduler-stack.ts # Gallery cleanup
├── cdk.json                   # CDK configuration
├── package.json               # Dependencies
└── tsconfig.json             # TypeScript config
```

## Resource Naming

Resources are named consistently:

- **Pattern**: `{prefix}-{resource}-{stage}-{suffix}`
- **Example**: `photographer-gallery-galleries-dev`

This allows multiple stages to coexist in the same AWS account.

## IAM Roles and Permissions

CDK automatically creates IAM roles for:

- **Lambda Execution Roles**: DynamoDB, S3, CloudWatch Logs access
- **API Gateway Role**: Invoke Lambda
- **CloudFormation Role**: Deploy and manage resources
- **CloudFront OAI**: Read from S3 buckets

All roles follow the principle of least privilege.

## Cost Optimization

Infrastructure includes several cost optimizations:

- **Lambda ARM64**: 20% cheaper than x86_64
- **DynamoDB On-Demand**: Pay per request (no provisioned capacity)
- **S3 Intelligent-Tiering**: Automatic cost optimization
- **CloudFront Caching**: Reduce S3 requests
- **Session TTL**: Automatic DynamoDB cleanup

**Estimated monthly cost** (light usage):
- DynamoDB: $0-5 (free tier)
- S3: $0-10
- Lambda: $0-5 (free tier)
- API Gateway: $0-5
- CloudFront: $0-5
- **Total**: ~$10-30/month

## Monitoring and Logs

All Lambda functions log to CloudWatch:

```bash
# Tail API logs
aws logs tail /aws/lambda/PhotographerGalleryApi-dev-ApiHandler --follow

# Tail Processor logs
aws logs tail /aws/lambda/PhotographerGalleryProcessor-dev-ProcessorHandler --follow

# Tail Scheduler logs
aws logs tail /aws/lambda/PhotographerGalleryScheduler-dev-SchedulerHandler --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/PhotographerGalleryApi-dev-ApiHandler \
  --filter-pattern "ERROR"
```

## Updates and Redeployment

### After Backend Code Changes

```bash
# 1. Rebuild Lambda functions
cd backend
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-api cmd/api/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-processor cmd/processor/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-scheduler cmd/scheduler/main.go

# 2. Redeploy (CDK detects changes and updates Lambda code)
cd ../infrastructure
npx cdk deploy --all
```

### After Infrastructure Changes

```bash
# Review changes
npx cdk diff

# Deploy changes
npx cdk deploy --all
```

## Troubleshooting

### CDK Bootstrap Error

**Error**: `This stack uses assets, so the toolkit stack must be deployed`

**Solution**:
```bash
npx cdk bootstrap
```

### Lambda Build Error

**Error**: `Cannot find asset at backend/bin/bootstrap-api`

**Solution**: Build Lambda functions first:
```bash
cd backend
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-api cmd/api/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-processor cmd/processor/main.go
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap-scheduler cmd/scheduler/main.go
```

### Docker Not Running

**Error**: `Cannot connect to Docker daemon`

**Solution**: Start Docker Desktop

### Deployment Fails

**Error**: Stack creation failed

**Solution**: Check CloudFormation events:
```bash
aws cloudformation describe-stack-events \
  --stack-name PhotographerGalleryApi-dev \
  --max-items 20
```

Common issues:
- Lambda binary not built
- Insufficient IAM permissions
- Resource name conflicts
- Cognito domain already taken

### Resource Conflicts

**Error**: `Resource already exists`

**Solution**: Change stage or destroy old stack:
```bash
npx cdk destroy PhotographerGalleryApi-dev
npx cdk deploy PhotographerGalleryApi-dev
```

## Clean Up

### Destroy All Resources

```bash
# Destroy all stacks
npx cdk destroy --all
```

### Manual Cleanup

Some resources might need manual deletion:

1. **Empty S3 buckets**:
   ```bash
   aws s3 rm s3://BUCKET-NAME --recursive
   ```

2. **Delete CloudWatch logs**:
   ```bash
   aws logs delete-log-group --log-group-name /aws/lambda/FUNCTION-NAME
   ```

3. **Check for remaining stacks**:
   ```bash
   aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
   ```

## Best Practices

1. **Use Stages**: Deploy dev, staging, and prod separately
2. **Review Diffs**: Always run `cdk diff` before deploying
3. **Tag Resources**: CDK automatically tags all resources
4. **Monitor Costs**: Set up AWS Budgets and billing alerts
5. **Version Control**: Commit CDK code to Git
6. **Test Changes**: Test in dev before deploying to prod
7. **Backup Data**: Export important DynamoDB data before major changes

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CDK TypeScript Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html)
- [AWS Lambda Go](https://docs.aws.amazon.com/lambda/latest/dg/lambda-golang.html)
- [Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

## Support

For deployment issues, see:
- [BUILD_AND_DEPLOY.md](../BUILD_AND_DEPLOY.md) - Complete deployment guide
- [AWS_DEPLOYMENT_QUICK_START.md](../AWS_DEPLOYMENT_QUICK_START.md) - Quick start guide
- [DEPLOY_TO_AWS.md](../DEPLOY_TO_AWS.md) - Detailed AWS instructions
