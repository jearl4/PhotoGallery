# AWS Deployment - Quick Start

## 🎯 Goal
Deploy backend to AWS, test frontend locally against real AWS services.

**✨ CDK Now Handles Everything!** - No manual build steps needed.

---

## ⚡ Super Quick Start (One Command!)

```bash
cd /Users/jt/Code/photographer-gallery

# Run automated deployment script
./deploy.sh
```

That's it! CDK will automatically:
1. ✅ Build your Go code in Docker
2. ✅ Package it for Lambda
3. ✅ Deploy all AWS infrastructure
4. ✅ Output configuration values

**Time:** ~15-20 minutes (first deploy)

---

## 📋 Prerequisites

Before running `./deploy.sh`, make sure you have:

1. **AWS Account** - Sign up at https://aws.amazon.com
2. **AWS CLI** - `brew install awscli`
3. **Docker Desktop** - https://www.docker.com/products/docker-desktop (Must be **running**)
4. **Node.js** - `brew install node`

Then configure AWS:
```bash
aws configure
# Enter your Access Key ID, Secret, region (us-east-1), format (json)
```

---

## 🐳 Why Docker?

**Short answer:** CDK uses Docker to build Go code automatically.

**How it works:**
1. CDK spins up a Docker container with Go installed
2. Compiles your `cmd/api/main.go` for Linux ARM64
3. Packages it for Lambda
4. Deploys to AWS

**You don't need to know Go or build anything manually!**

---

## 📝 Manual Steps (If You Prefer)

```bash
# 1. Configure AWS
aws configure

# 2. Start Docker Desktop (GUI)
# Make sure Docker is running!

# 3. Deploy
cd infrastructure
npm install
npx cdk bootstrap  # First time only
npx cdk deploy --all
```

CDK handles the Go build automatically during deployment.

---

## ✅ After Deployment

### 1. Save Output Values
CDK outputs these (copy them):
```
ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com/dev/
UserPoolId = us-east-1_XXXXXXXXX
UserPoolClientId = 1234567890abcdefg
CognitoDomain = photographer-gallery-dev-xxxxx
```

### 2. Configure Cognito
AWS Console → Cognito → Your User Pool:
- App integration → Add callback URL: `http://localhost:4200/auth/callback`
- (Optional) Add social providers (Google, Facebook, Apple)

### 3. Update Frontend
Edit `frontend/src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  apiUrl: 'https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/api/v1',
  cognitoUserPoolId: 'us-east-1_XXXXXXXXX',
  cognitoClientId: 'YOUR-CLIENT-ID',
  cognitoRegion: 'us-east-1',
  cognitoDomain: 'YOUR-COGNITO-DOMAIN',
};
```

### 4. Start Frontend
```bash
cd frontend
npm start
# Open http://localhost:4200
```

---

## 🎨 What Gets Deployed

**AWS Infrastructure:**
- 🗄️ **DynamoDB** - 4 tables (galleries, photos, favorites, sessions)
- 📦 **S3** - 3 buckets (original, optimized, thumbnail)
- 🔐 **Cognito** - User pool for authentication
- ⚡ **Lambda** - Your Go API (auto-built by CDK)
- 🌐 **API Gateway** - REST API endpoints
- 📊 **CloudWatch** - Logs and monitoring

**Cost:**
- Most covered by AWS free tier
- Estimated $5-15/month for light development
- Can destroy when not using (free)

---

## 🧪 Testing Flow

1. **Start frontend**: `npm start` in frontend folder
2. **Visit**: http://localhost:4200
3. **Login**: Click login → Cognito Hosted UI → Sign in
4. **Create gallery**: Saved to real DynamoDB
5. **Upload photos**: Stored in real S3
6. **Client access**: Real password verification
7. **Everything works** like production!

---

## 🔍 Verify Deployment

```bash
# Test API health
curl https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/api/v1/health

# List DynamoDB tables
aws dynamodb list-tables

# List S3 buckets
aws s3 ls

# Check Lambda function
aws lambda list-functions | grep PhotographerGallery
```

---

## 🧹 Clean Up

When done testing:
```bash
cd infrastructure
npx cdk destroy --all
```

This removes all resources and stops billing.

---

## 📊 Deployment Timeline

**First Deploy:**
- CDK bootstrap: ~2 min
- Building Go in Docker: ~3 min
- Creating resources: ~10 min
- **Total: ~15 min**

**Subsequent Deploys:**
- Docker build cached: ~1 min
- Update resources: ~5 min
- **Total: ~6 min**

---

## ❓ Troubleshooting

### Docker not running
```bash
# Start Docker Desktop (GUI application)
# Wait for it to finish starting
# Then retry deployment
```

### AWS credentials error
```bash
# Check credentials
aws sts get-caller-identity

# Reconfigure if needed
aws configure
```

### Build fails
```bash
# Check Docker is running
docker info

# Check Go code compiles
cd backend
go build cmd/api/main.go
```

### Can't login
- Check Cognito callback URL: `http://localhost:4200/auth/callback`
- Check frontend environment.ts values
- Check browser console for errors

---

## 💡 Key Points

1. **Docker Required**: CDK uses Docker to build Go code
2. **No Manual Build**: CDK handles everything automatically
3. **First Deploy Slower**: Docker downloads Go toolchain
4. **Cached Builds**: Subsequent deploys are much faster
5. **Free Tier**: AWS free tier covers most development usage

---

## 🎉 Ready to Deploy?

Make sure Docker Desktop is running, then:

```bash
cd /Users/jt/Code/photographer-gallery
./deploy.sh
```

The script will:
- ✅ Check all prerequisites
- ✅ Build Go code in Docker (automatically)
- ✅ Deploy to AWS
- ✅ Show you the config values

Good luck! 🚀
