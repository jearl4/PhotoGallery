# Deployment Guide

Complete guide for deploying the Photographer Gallery application to AWS.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Node.js** 18+ and npm
4. **Go** 1.21+
5. **AWS CDK CLI**: `npm install -g aws-cdk`
6. **OAuth Provider Credentials**:
   - Google OAuth Client ID and Secret
   - Facebook App ID and Secret
   - Apple Services ID, Team ID, Key ID, and Private Key

## Step 1: Configure OAuth Providers

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `https://photographer-gallery-dev-{account}.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
6. Save Client ID and Client Secret

### Facebook OAuth

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add Facebook Login product
4. Configure Valid OAuth Redirect URIs:
   - `https://photographer-gallery-dev-{account}.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
5. Save App ID and App Secret

### Apple Sign In

1. Go to [Apple Developer](https://developer.apple.com/)
2. Register a new Services ID
3. Configure Sign in with Apple
4. Create a private key
5. Save Services ID, Team ID, Key ID, and Private Key

## Step 2: Set Environment Variables

Create a `.env` file in the infrastructure directory:

```bash
cd infrastructure

cat > .env <<EOF
# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
APPLE_SERVICES_ID=your-apple-services-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY=your-apple-private-key

# AWS
AWS_REGION=us-east-1
CDK_DEFAULT_ACCOUNT=your-aws-account-id
CDK_DEFAULT_REGION=us-east-1
EOF

# Load environment variables
source .env
export $(cat .env | grep -v '^#' | xargs)
```

## Step 3: Bootstrap CDK (First Time Only)

```bash
cd infrastructure
cdk bootstrap aws://${CDK_DEFAULT_ACCOUNT}/${CDK_DEFAULT_REGION}
```

## Step 4: Build and Deploy Infrastructure

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Synthesize CloudFormation templates (optional - to review)
npm run synth

# Deploy all stacks to dev environment
cdk deploy --all --context stage=dev --require-approval never

# Or deploy stacks individually
cdk deploy PhotographerGalleryDatabase-dev --context stage=dev
cdk deploy PhotographerGalleryStorage-dev --context stage=dev
cdk deploy PhotographerGalleryAuth-dev --context stage=dev
```

## Step 5: Build Backend Lambda Functions

```bash
cd ../backend

# Build for Lambda (ARM64)
GOOS=linux GOARCH=arm64 go build -o bootstrap cmd/api/main.go
zip -j api-lambda.zip bootstrap

# Upload to S3 or deploy via CDK
# (This will be automated in the API stack)
```

## Step 6: Deploy Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Build for production
ng build --configuration production

# Deploy to S3 (via CDK frontend stack)
# This will be created in a future phase
```

## Step 7: Configure Frontend Environment

After deploying infrastructure, update frontend environment with outputs:

```bash
# Get CDK outputs
cd ../infrastructure
cdk deploy --all --context stage=dev --outputs-file outputs.json

# Update frontend environment
cd ../frontend
cat > src/environments/environment.prod.ts <<EOF
export const environment = {
  production: true,
  apiUrl: 'https://your-api-gateway-url/api/v1',
  cognitoUserPoolId: 'us-east-1_xxxxx',
  cognitoClientId: 'xxxxx',
  cognitoRegion: 'us-east-1',
  cognitoDomain: 'photographer-gallery-dev-xxxxx.auth.us-east-1.amazoncognito.com',
};
EOF
```

## Step 8: Verify Deployment

### Test Database

```bash
aws dynamodb list-tables --region us-east-1 | grep photographer-gallery
```

### Test S3 Buckets

```bash
aws s3 ls | grep photographer-gallery
```

### Test Cognito

```bash
aws cognito-idp list-user-pools --max-results 10 --region us-east-1
```

### Test API

```bash
# Health check
curl https://your-api-gateway-url/health
```

## Production Deployment

For production deployment, use the `prod` stage:

```bash
# Deploy to production
cdk deploy --all --context stage=prod --require-approval broadening

# Different configuration for prod
export GOOGLE_CLIENT_ID=prod-google-client-id
export FACEBOOK_APP_ID=prod-facebook-app-id
# ... etc
```

### Production Considerations

1. **Custom Domain**: Add custom domain for API and frontend
2. **SSL Certificates**: Use ACM for HTTPS
3. **WAF**: Enable AWS WAF on CloudFront and API Gateway
4. **Monitoring**: Set up CloudWatch alarms
5. **Backup**: Enable point-in-time recovery for DynamoDB
6. **Secrets**: Use AWS Secrets Manager for OAuth credentials
7. **CI/CD**: Set up GitHub Actions or AWS CodePipeline

## Cost Estimation

### Development Environment
- DynamoDB: ~$5/month (on-demand, low traffic)
- S3: ~$10/month (100GB storage)
- CloudFront: ~$5/month (low traffic)
- Lambda: ~$5/month (100K requests)
- Cognito: Free tier (50K MAU)
- **Total: ~$25/month**

### Production Environment (1000 galleries, 50K photos)
- DynamoDB: ~$40/month
- S3: ~$80/month (with Intelligent-Tiering)
- CloudFront: ~$50/month
- Lambda: ~$20/month
- Cognito: ~$10/month
- API Gateway: ~$15/month
- **Total: ~$215/month**

## Monitoring and Maintenance

### CloudWatch Dashboards

```bash
# View logs
aws logs tail /aws/lambda/photographer-gallery-api-dev --follow

# View metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=photographer-gallery-api-dev \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Cost Monitoring

```bash
# Set up billing alerts
aws cloudwatch put-metric-alarm \
  --alarm-name photographer-gallery-billing \
  --alarm-description "Alert when monthly costs exceed $50" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --evaluation-periods 1 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold
```

## Rollback

If deployment fails:

```bash
# Destroy specific stack
cdk destroy PhotographerGalleryDatabase-dev

# Destroy all stacks
cdk destroy --all --context stage=dev
```

## Troubleshooting

### Common Issues

1. **CDK Bootstrap Error**
   ```bash
   # Re-bootstrap with specific version
   cdk bootstrap --toolkit-stack-name CDKToolkit
   ```

2. **Lambda Timeout**
   - Increase timeout in CDK stack
   - Check CloudWatch logs for errors

3. **Cognito OAuth Error**
   - Verify redirect URIs match exactly
   - Check OAuth credentials are correct

4. **DynamoDB Access Error**
   - Verify Lambda execution role has permissions
   - Check table names match configuration

5. **S3 Upload Fails**
   - Verify CORS configuration
   - Check presigned URL expiration

## Next Steps

After successful deployment:

1. Test all API endpoints
2. Upload test photos
3. Create test galleries
4. Verify client access
5. Monitor costs and performance
6. Set up automated backups
7. Configure alerting
8. Document API for users
