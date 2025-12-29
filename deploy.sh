#!/bin/bash

# Photographer Gallery - AWS Deployment Script
# CDK now handles Go build automatically!

set -e  # Exit on error

echo "🚀 Photographer Gallery - AWS Deployment"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Install it first:${NC}"
    echo "   brew install awscli"
    exit 1
fi
echo -e "${GREEN}✅ AWS CLI found${NC}"

# Check Docker (needed for CDK bundling)
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. CDK needs Docker to build Go code.${NC}"
    echo "   Install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Install it first:${NC}"
    echo "   brew install node"
    exit 1
fi
echo -e "${GREEN}✅ Node.js found${NC}"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    echo "   Run: aws configure"
    exit 1
fi
echo -e "${GREEN}✅ AWS credentials configured${NC}"

echo ""
echo "ℹ️  CDK will automatically build your Go code using Docker"
echo "   No manual build steps needed!"
echo ""

# Deploy infrastructure
echo "📦 Deploying infrastructure to AWS..."
cd infrastructure

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "   Installing CDK dependencies..."
    npm install --silent
fi

# Check if CDK is bootstrapped
echo "   Checking CDK bootstrap..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit &> /dev/null; then
    echo -e "${YELLOW}⚠️  CDK not bootstrapped. Bootstrapping now...${NC}"
    npx cdk bootstrap
fi

# Deploy stacks
echo ""
echo "   Deploying stacks..."
echo "   📦 Building Go Lambda (this happens automatically in Docker)"
echo "   ⏱️  This may take 10-15 minutes on first deploy"
echo ""

npx cdk deploy --all --require-approval never

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Copy the output values above"
    echo "   2. Update frontend/src/environments/environment.ts"
    echo "   3. Configure Cognito callback URLs in AWS Console"
    echo "   4. Add social providers (Google/Facebook/Apple)"
    echo "   5. Run: cd frontend && npm start"
    echo ""
    echo "📚 See AWS_DEPLOYMENT_QUICK_START.md for detailed instructions"
    echo ""
else
    echo -e "${RED}❌ Deployment failed${NC}"
    echo "   Check the error messages above"
    exit 1
fi
