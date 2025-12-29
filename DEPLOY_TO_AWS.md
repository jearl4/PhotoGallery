# 🚀 Deploy to AWS - Step by Step Guide

This guide will walk you through deploying the photographer gallery application to AWS.

---

## ✅ Prerequisites

### 1. AWS Account
- Sign up at https://aws.amazon.com if you don't have one
- You'll need credit card for verification (free tier available)

### 2. AWS CLI Installed
```bash
# Check if installed
aws --version

# If not installed (macOS):
brew install awscli

# Or download from: https://aws.amazon.com/cli/
```

### 3. Configure AWS Credentials
```bash
aws configure
```

You'll need:
- **AWS Access Key ID**: Get from AWS Console → IAM → Users → Security Credentials
- **AWS Secret Access Key**: Shown when you create access key
- **Default region**: `us-east-1` (recommended)
- **Default output format**: `json`

### 4. Node.js & Go Installed
```bash
# Check versions
node --version  # Should be 18+
go version      # Should be 1.21+
```

---

## 📦 Step 1: Build the Go Lambda Function

```bash
# Navigate to backend
cd /Users/jt/Code/photographer-gallery/backend

# Build for Lambda (ARM64 architecture)
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bin/bootstrap cmd/api/main.go

# Create deployment package
cd bin
zip api.zip bootstrap
cd ..
```

**Expected output:**
```
bin/
├── bootstrap  # The compiled Go binary
└── api.zip    # The deployment package for Lambda
```

---

## 📋 Step 2: Bootstrap CDK (First Time Only)

```bash
cd /Users/jt/Code/photographer-gallery/infrastructure

# Install CDK dependencies
npm install

# Bootstrap CDK in your AWS account (only needed once per account/region)
npx cdk bootstrap
```

**What this does:**
- Creates an S3 bucket for CDK assets
- Creates IAM roles for CloudFormation
- Sets up the CDK toolkit stack

---

## 🏗️ Step 3: Deploy Infrastructure

### Option A: Deploy Everything at Once

```bash
cd /Users/jt/Code/photographer-gallery/infrastructure

# Deploy all stacks
npx cdk deploy --all --require-approval never
```

### Option B: Deploy Stack by Stack (Recommended for First Time)

```bash
# 1. Deploy Database (DynamoDB tables)
npx cdk deploy PhotographerGalleryDatabase-dev

# 2. Deploy Storage (S3 buckets)
npx cdk deploy PhotographerGalleryStorage-dev

# 3. Deploy Auth (Cognito)
npx cdk deploy PhotographerGalleryAuth-dev

# 4. Deploy API (Lambda + API Gateway)
npx cdk deploy PhotographerGalleryApi-dev
```

**Deployment time:** ~10-15 minutes total

---

## 📝 Step 4: Collect Output Values

After deployment, CDK will output important values. **Save these!**

```
Outputs:
PhotographerGalleryApi-dev.ApiUrl = https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev/
PhotographerGalleryAuth-dev.UserPoolId = us-east-1_XXXXXXXXX
PhotographerGalleryAuth-dev.UserPoolClientId = 1234567890abcdefghijk
PhotographerGalleryAuth-dev.CognitoDomain = photographer-gallery-dev-xxxxx
```

You can also retrieve them later:
```bash
# List all stacks
npx cdk list

# Get outputs for a specific stack
aws cloudformation describe-stacks --stack-name PhotographerGalleryApi-dev --query 'Stacks[0].Outputs'
```

---

## 🔐 Step 5: Configure Cognito

### 1. Open AWS Console
https://console.aws.amazon.com/cognito/

### 2. Select Your User Pool
- Find: `photographer-gallery-users-dev`
- Click on it

### 3. Configure App Client
- Go to "App integration" tab
- Click on your app client
- Scroll to "Hosted UI"

### 4. Add Callback URLs
- **Allowed callback URLs**:
  ```
  http://localhost:4200/auth/callback
  https://your-production-domain.com/auth/callback
  ```

- **Allowed sign-out URLs**:
  ```
  http://localhost:4200
  https://your-production-domain.com
  ```

### 5. Enable Social Providers (Optional but Recommended)

#### Google OAuth:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI:
   ```
   https://<your-cognito-domain>.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
   ```
4. Copy Client ID and Secret
5. In Cognito → Identity providers → Add "Google"
6. Paste Client ID and Secret

#### Facebook OAuth:
1. Go to https://developers.facebook.com/apps
2. Create app → Consumer → Add Facebook Login
3. Settings → Basic → Copy App ID and App Secret
4. In Cognito → Identity providers → Add "Facebook"

#### Apple OAuth:
1. Go to https://developer.apple.com/account/resources/identifiers
2. Register a Services ID
3. Configure Sign in with Apple
4. In Cognito → Identity providers → Add "Apple"

### 6. Configure Hosted UI
- Domain: Already created (from CDK output)
- OAuth 2.0 grant types: ✅ Authorization code grant
- OpenID Connect scopes: ✅ openid, email, profile

---

## 🎨 Step 6: Update Frontend Configuration

Edit `frontend/src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,

  // From PhotographerGalleryApi-dev.ApiUrl output
  apiUrl: 'https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev/api/v1',

  // From PhotographerGalleryAuth-dev outputs
  cognitoUserPoolId: 'us-east-1_XXXXXXXXX',
  cognitoClientId: '1234567890abcdefghijk',
  cognitoRegion: 'us-east-1',
  cognitoDomain: 'photographer-gallery-dev-xxxxx',
};
```

---

## 🧪 Step 7: Test the Application

### 1. Start Frontend
```bash
cd /Users/jt/Code/photographer-gallery/frontend
npm start
```

### 2. Open Browser
```
http://localhost:4200
```

### 3. Test Features

✅ **Login**
- Click "Sign in with Social Login"
- You'll be redirected to Cognito Hosted UI
- Sign in with Google/Facebook/Apple
- You'll be redirected back to your app

✅ **Create Gallery**
- Should work and save to DynamoDB
- Check AWS Console → DynamoDB → Tables

✅ **Upload Photos**
- Upload should work and store in S3
- Check AWS Console → S3 → Buckets

✅ **Client Access**
- Visit gallery URL
- Enter password
- View photos

---

## 🔍 Verify Deployment

### Check DynamoDB Tables
```bash
aws dynamodb list-tables
```

Expected tables:
- photographer-gallery-galleries-dev
- photographer-gallery-photos-dev
- photographer-gallery-favorites-dev
- photographer-gallery-sessions-dev

### Check S3 Buckets
```bash
aws s3 ls
```

Expected buckets:
- photographergallery-original-dev-xxxxx
- photographergallery-optimized-dev-xxxxx
- photographergallery-thumbnail-dev-xxxxx

### Check Lambda Function
```bash
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `PhotographerGallery`)].FunctionName'
```

### Check API Gateway
```bash
aws apigateway get-rest-apis
```

### Test API Health
```bash
curl https://your-api-url.execute-api.us-east-1.amazonaws.com/dev/api/v1/health
```

---

## 💰 Cost Monitoring

### View Current Charges
```bash
# AWS Console
https://console.aws.amazon.com/billing/

# Or use CLI
aws ce get-cost-and-usage \
  --time-period Start=2025-12-01,End=2025-12-31 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

### Set Up Billing Alerts
1. Go to AWS Console → Billing → Budgets
2. Create budget
3. Set alert for $10, $20, $50

### Estimated Costs (Development)
- DynamoDB: ~$0-5/month (free tier)
- S3: ~$0-3/month (free tier)
- Lambda: ~$0/month (free tier - 1M requests)
- API Gateway: ~$0-2/month
- Cognito: ~$0/month (free tier - 50K MAUs)
- **Total: ~$5-15/month**

---

## 🧹 Clean Up (When Done Testing)

### Destroy All Resources
```bash
cd /Users/jt/Code/photographer-gallery/infrastructure

# Destroy all stacks
npx cdk destroy --all
```

### Manual Cleanup (if needed)
Some resources might need manual deletion:

1. **S3 Buckets** (if they have content):
   ```bash
   aws s3 rm s3://bucket-name --recursive
   aws s3 rb s3://bucket-name
   ```

2. **CloudWatch Logs**:
   - Go to CloudWatch → Log groups
   - Delete photographer-gallery log groups

---

## 🔧 Troubleshooting

### Build Errors
**Error**: `go: command not found`
```bash
brew install go
```

**Error**: `zip: command not found`
```bash
# macOS has zip by default, but if needed:
brew install zip
```

### CDK Errors
**Error**: `Need to perform AWS calls for account XXX, but no credentials found`
```bash
aws configure
# Then re-enter your credentials
```

**Error**: `Unable to resolve AWS account to use`
```bash
# Check AWS credentials are set
aws sts get-caller-identity

# If not working, reconfigure
aws configure
```

### Deployment Failures
**Error**: Stack creation failed
```bash
# Check CloudFormation events
aws cloudformation describe-stack-events --stack-name PhotographerGalleryApi-dev

# Common issues:
# 1. Lambda code not built: Run build step again
# 2. Insufficient permissions: Check IAM roles
# 3. Resource name conflicts: Destroy and redeploy
```

### Lambda Errors
**Error**: Function failing
```bash
# Check Lambda logs
aws logs tail /aws/lambda/PhotographerGalleryApi-dev-ApiHandler --follow

# Check function configuration
aws lambda get-function --function-name PhotographerGalleryApi-dev-ApiHandler
```

### API Gateway Errors
**Error**: 403 Forbidden
- Check Cognito configuration
- Verify callback URLs are correct
- Check CORS settings

**Error**: 502 Bad Gateway
- Lambda function is failing
- Check Lambda logs (see above)

---

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda Go](https://docs.aws.amazon.com/lambda/latest/dg/lambda-golang.html)
- [Cognito Hosted UI](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

---

## ✅ Success Checklist

- [ ] AWS credentials configured
- [ ] Go Lambda function built (bin/api.zip exists)
- [ ] CDK bootstrapped
- [ ] All stacks deployed successfully
- [ ] Output values collected
- [ ] Cognito configured with callback URLs
- [ ] Social providers enabled (optional)
- [ ] Frontend environment.ts updated
- [ ] Application tested in browser
- [ ] Login works
- [ ] Can create galleries
- [ ] Can upload photos
- [ ] Client access works

---

## 🎉 You're Done!

Your photographer gallery is now running on AWS with:
- ✅ Serverless Lambda backend
- ✅ DynamoDB database
- ✅ S3 storage
- ✅ Cognito authentication
- ✅ API Gateway endpoints
- ✅ Production-ready infrastructure

Ready to share with clients! 📸
