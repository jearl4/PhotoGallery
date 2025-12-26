# Backend Testing Guide

Complete guide for testing the Photographer Gallery backend.

## Prerequisites

1. **AWS Account** with credentials configured
2. **Go 1.21+** installed
3. **AWS SAM CLI** (optional, for local testing)
4. **Docker** (optional, for SAM local)
5. **curl** or **Postman** for API testing

## Testing Options

### Option 1: Unit Testing (Fastest)

Test individual components without AWS:

```bash
cd backend

# Run all tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run specific package tests
go test ./internal/domain/gallery/...
go test ./internal/repository/dynamodb/...
```

**Note**: Unit tests are not yet implemented. You can add them by creating `*_test.go` files.

### Option 2: Local Build Test (Quick Validation)

Verify the code compiles and check for errors:

```bash
cd backend

# Run the test script
./test-local.sh

# Or manually build
go build -o bin/api cmd/api/main.go

# Check binary
ls -lh bin/api
```

✅ **Current Status**: Backend compiles successfully to 27MB binary!

### Option 3: AWS SAM Local (Lambda Simulation)

Test the Lambda function locally using SAM:

#### Step 1: Install SAM CLI

```bash
# macOS
brew install aws-sam-cli

# Verify installation
sam --version
```

#### Step 2: Create SAM Template

Create `backend/template.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: .
      Handler: bootstrap
      Runtime: provided.al2
      Architectures:
        - arm64
      MemorySize: 512
      Timeout: 30
      Environment:
        Variables:
          AWS_REGION: us-east-1
          DYNAMODB_TABLE_PREFIX: photographer-gallery
          S3_BUCKET_ORIGINAL: test-originals
          S3_BUCKET_OPTIMIZED: test-optimized
          S3_BUCKET_THUMBNAIL: test-thumbnails
          COGNITO_USER_POOL_ID: test-pool
          COGNITO_CLIENT_ID: test-client
          API_STAGE: local
          JWT_SECRET: test-secret
      Events:
        ApiEvent:
          Type: Api
          Properties:
            Path: /{proxy+}
            Method: ANY
```

#### Step 3: Build and Test

```bash
cd backend

# Build for Lambda
GOOS=linux GOARCH=arm64 go build -o bootstrap cmd/api/main.go

# Start SAM local
sam local start-api --template template.yaml

# In another terminal, test endpoints
curl http://localhost:3000/health
```

### Option 4: Deploy to AWS (Full Integration Test)

Deploy to AWS and test with real services:

#### Step 1: Deploy Infrastructure

```bash
cd infrastructure

# Set OAuth credentials
export GOOGLE_CLIENT_ID=your-id
export GOOGLE_CLIENT_SECRET=your-secret
# ... (other OAuth credentials)

# Deploy
cdk deploy --all --context stage=dev
```

#### Step 2: Create API Stack

Add this to `infrastructure/lib/stacks/api-stack.ts`:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: any) {
    super(scope, id, props);

    // Lambda function
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      functionName: `photographer-gallery-api-${props.stage}`,
      runtime: lambda.Runtime.PROVIDED_AL2,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../backend', {
        bundling: {
          image: lambda.Runtime.PROVIDED_AL2.bundlingImage,
          command: [
            'bash', '-c',
            'GOOS=linux GOARCH=arm64 go build -o /asset-output/bootstrap cmd/api/main.go'
          ],
        },
      }),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        AWS_REGION: this.region,
        DYNAMODB_TABLE_PREFIX: 'photographer-gallery',
        S3_BUCKET_ORIGINAL: cdk.Fn.importValue(`OriginalBucket-${props.stage}`),
        S3_BUCKET_OPTIMIZED: cdk.Fn.importValue(`OptimizedBucket-${props.stage}`),
        S3_BUCKET_THUMBNAIL: cdk.Fn.importValue(`ThumbnailBucket-${props.stage}`),
        COGNITO_USER_POOL_ID: cdk.Fn.importValue(`UserPoolId-${props.stage}`),
        COGNITO_CLIENT_ID: cdk.Fn.importValue(`UserPoolClientId-${props.stage}`),
        API_STAGE: props.stage,
        JWT_SECRET: process.env.JWT_SECRET || 'generate-a-secret',
      },
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: `photographer-gallery-${props.stage}`,
      deployOptions: {
        stageName: props.stage,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const integration = new apigateway.LambdaIntegration(apiFunction);
    api.root.addProxy({
      defaultIntegration: integration,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      exportName: `ApiUrl-${props.stage}`,
    });
  }
}
```

#### Step 3: Deploy API

```bash
cd infrastructure
cdk deploy PhotographerGalleryApi-dev
```

#### Step 4: Test with curl

```bash
# Get API URL from CDK output
API_URL="https://your-api-id.execute-api.us-east-1.amazonaws.com/dev"

# Health check
curl $API_URL/health

# Expected response:
# {"status":"healthy"}
```

## Test Scenarios

### 1. Health Check

```bash
curl http://localhost:3000/health

# Expected: {"status":"healthy"}
```

### 2. Create Gallery (Requires Auth Token)

```bash
# First, get a Cognito token (via AWS Console or Cognito Hosted UI)
TOKEN="your-cognito-jwt-token"

curl -X POST http://localhost:3000/api/v1/galleries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Wedding Photos",
    "description": "John and Jane Wedding - May 2024",
    "customUrl": "john-jane-wedding",
    "password": "secure123",
    "expiresAt": "2025-12-31T23:59:59Z"
  }'
```

### 3. Client Verify Password

```bash
curl -X POST http://localhost:3000/api/v1/client/verify \
  -H "Content-Type: application/json" \
  -d '{
    "customUrl": "john-jane-wedding",
    "password": "secure123"
  }'

# Expected: {"sessionToken":"...", "gallery":{...}}
```

### 4. List Photos (Client)

```bash
SESSION_TOKEN="token-from-verify"

curl http://localhost:3000/api/v1/client/galleries/john-jane-wedding/photos \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

## Integration Testing with Postman

### Import Collection

Create a Postman collection with these requests:

1. **Health Check**
   - GET `/health`

2. **Photographer Login** (Manual)
   - Open Cognito Hosted UI
   - Copy JWT token from callback

3. **Create Gallery**
   - POST `/api/v1/galleries`
   - Header: `Authorization: Bearer {token}`

4. **List Galleries**
   - GET `/api/v1/galleries`
   - Header: `Authorization: Bearer {token}`

5. **Client Verify**
   - POST `/api/v1/client/verify`

6. **Client List Photos**
   - GET `/api/v1/client/galleries/{customUrl}/photos`
   - Header: `Authorization: Bearer {sessionToken}`

## Automated Testing

### Create Integration Tests

Create `backend/integration_test.go`:

```go
package main

import (
    "context"
    "encoding/json"
    "testing"

    "github.com/aws/aws-lambda-go/events"
)

func TestHealthCheck(t *testing.T) {
    app, _ := initializeApp()

    req := events.APIGatewayProxyRequest{
        HTTPMethod: "GET",
        Path:       "/health",
    }

    resp, err := app.handler(context.Background(), req)
    if err != nil {
        t.Fatalf("handler error: %v", err)
    }

    if resp.StatusCode != 200 {
        t.Errorf("expected 200, got %d", resp.StatusCode)
    }

    var body map[string]string
    json.Unmarshal([]byte(resp.Body), &body)

    if body["status"] != "healthy" {
        t.Errorf("expected healthy status, got %s", body["status"])
    }
}
```

Run tests:

```bash
go test -v
```

## Load Testing

### Using Apache Bench

```bash
# Install ab (usually pre-installed on macOS)
which ab

# Test health endpoint
ab -n 1000 -c 10 http://localhost:3000/health

# Results will show:
# - Requests per second
# - Time per request
# - Transfer rate
```

### Using wrk

```bash
# Install wrk
brew install wrk

# Load test
wrk -t4 -c100 -d30s http://localhost:3000/health

# Test with POST
wrk -t4 -c100 -d30s -s post.lua http://localhost:3000/api/v1/client/verify
```

## Monitoring

### CloudWatch Logs

After deploying to AWS:

```bash
# Tail logs
aws logs tail /aws/lambda/photographer-gallery-api-dev --follow

# Filter errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/photographer-gallery-api-dev \
  --filter-pattern "ERROR"
```

### X-Ray Tracing

Enable X-Ray in Lambda configuration:

```typescript
// In api-stack.ts
tracing: lambda.Tracing.ACTIVE,
```

View traces in AWS X-Ray console.

## Troubleshooting

### Common Issues

**1. Build Fails**
```bash
# Clean and rebuild
go clean
go mod tidy
go build -o bin/api cmd/api/main.go
```

**2. AWS Credentials**
```bash
# Check credentials
aws sts get-caller-identity

# Configure if needed
aws configure
```

**3. DynamoDB Errors**
- Ensure tables are created via CDK
- Check table names match environment variables
- Verify IAM permissions

**4. Cognito Errors**
- Verify user pool exists
- Check OAuth credentials are set
- Ensure callback URLs match

**5. S3 Errors**
- Confirm buckets are created
- Check bucket names in environment
- Verify IAM permissions

## Next Steps

1. ✅ Backend compiles successfully
2. 🔄 Deploy infrastructure with CDK
3. 🔄 Create API stack for Lambda deployment
4. 🔄 Test with real AWS services
5. 🔄 Build frontend to consume API
6. 🔄 Add comprehensive unit tests
7. 🔄 Set up CI/CD pipeline

## Quick Start for Testing

```bash
# 1. Build
cd backend
./test-local.sh

# 2. Deploy infrastructure
cd ../infrastructure
cdk deploy --all --context stage=dev

# 3. Test health endpoint (after deploying API stack)
curl https://your-api-url/health

# 4. Start building frontend
cd ../frontend
npm start
```

Your backend is ready to test! 🚀
