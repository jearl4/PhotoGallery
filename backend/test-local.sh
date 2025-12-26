#!/bin/bash

# Test script for local backend testing
# This simulates API Gateway events for testing the Lambda handler

echo "Testing Photographer Gallery Backend"
echo "===================================="
echo ""

# Set environment variables for local testing
export AWS_REGION=us-east-1
export DYNAMODB_TABLE_PREFIX=photographer-gallery
export S3_BUCKET_ORIGINAL=test-originals
export S3_BUCKET_OPTIMIZED=test-optimized
export S3_BUCKET_THUMBNAIL=test-thumbnails
export COGNITO_USER_POOL_ID=test-pool
export COGNITO_CLIENT_ID=test-client
export API_STAGE=local
export JWT_SECRET=test-secret-for-local-development

echo "Environment variables set for local testing"
echo ""

# Build the binary
echo "Building backend..."
go build -o bin/api cmd/api/main.go

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "Binary created at: bin/api"
    echo "Size: $(ls -lh bin/api | awk '{print $5}')"
    echo ""
    echo "To deploy to Lambda:"
    echo "  GOOS=linux GOARCH=arm64 go build -o bootstrap cmd/api/main.go"
    echo "  zip api-lambda.zip bootstrap"
else
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "Next steps for testing:"
echo "1. Deploy infrastructure: cd ../infrastructure && cdk deploy --all"
echo "2. Test with AWS SAM Local (requires SAM CLI)"
echo "3. Deploy to AWS and test with curl/Postman"
echo "4. Use the test event files in backend/test-events/"
