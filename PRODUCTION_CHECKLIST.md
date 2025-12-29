# Production Readiness Checklist

This checklist tracks everything needed to make this app production-ready.

---

## 🔐 Security & Authentication

### High Priority
- [ ] **Migrate JWT_SECRET to AWS Secrets Manager**
  - Current: Using environment variable with default fallback
  - Action: Create secret in AWS Secrets Manager
  - File: `infrastructure/lib/stacks/api-stack.ts`
  - Code:
    ```typescript
    const jwtSecret = secretsmanager.Secret.fromSecretNameV2(this, 'JWTSecret', 'jwt-secret');
    environment: {
      JWT_SECRET: jwtSecret.secretValue.toString(),
    }
    ```

- [ ] **Remove default JWT secret fallback**
  - Current: `'dev-secret-change-in-production'`
  - File: `backend/cmd/api/main.go:105`
  - Action: Require environment variable, fail startup if missing

- [ ] **Enable AWS GuardDuty**
  - Purpose: Threat detection and monitoring
  - Action: Enable in AWS Console → GuardDuty

- [ ] **Set up AWS CloudTrail**
  - Purpose: Audit logging for all API calls
  - Action: Enable CloudTrail for the account/region

- [ ] **Configure AWS WAF (Web Application Firewall)**
  - Purpose: Protect API Gateway from common attacks
  - Features: Rate limiting, SQL injection protection, XSS protection
  - File: Create `infrastructure/lib/stacks/waf-stack.ts`

- [ ] **Add rate limiting to API endpoints**
  - Current: No rate limiting
  - Options: API Gateway throttling or WAF rate-based rules
  - Recommended: 100 requests/minute per IP for authenticated endpoints

### Medium Priority
- [ ] **Implement secret rotation**
  - JWT secrets should rotate periodically
  - Use AWS Secrets Manager automatic rotation

- [ ] **Add Content Security Policy (CSP) headers**
  - File: `frontend/src/index.html` or API Gateway response
  - Example:
    ```
    Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
    ```

- [ ] **Enable CORS for production domain only**
  - Current: `apigateway.Cors.ALL_ORIGINS` for dev
  - File: `infrastructure/lib/stacks/api-stack.ts:98`
  - Action: Update to `['https://yourdomain.com']`

- [ ] **Set up API Gateway API keys**
  - Add API key requirement for sensitive endpoints
  - Track usage per client

---

## 🗄️ Database & Storage

### High Priority
- [ ] **Enable DynamoDB Point-in-Time Recovery (PITR) for prod**
  - Current: Only enabled for prod stage in code
  - File: `infrastructure/lib/stacks/database-stack.ts`
  - Status: ✅ Already configured, verify it's working

- [ ] **Set up DynamoDB backups**
  - Configure daily automated backups
  - Set retention policy (30 days recommended)

- [ ] **Implement DynamoDB Auto Scaling**
  - Current: PAY_PER_REQUEST mode (good for variable workloads)
  - Consider: Switch to PROVISIONED with auto-scaling for cost optimization if traffic is predictable

- [ ] **Configure S3 lifecycle policies for all buckets**
  - Current: Basic lifecycle in place
  - File: `infrastructure/lib/stacks/storage-stack.ts:33-47`
  - Action: Review and optimize transition rules
  - Add: Delete incomplete multipart uploads after 7 days

- [ ] **Enable S3 versioning for critical buckets**
  - Buckets: Original photos bucket
  - Purpose: Recover from accidental deletions

- [ ] **Set up S3 bucket replication (optional)**
  - For disaster recovery
  - Replicate to different region

### Medium Priority
- [ ] **Implement DynamoDB Time-to-Live (TTL) cleanup**
  - Current: TTL enabled for sessions table
  - Action: Verify TTL is working correctly
  - Add: TTL for expired galleries

- [ ] **Add DynamoDB streams for audit logging**
  - Track all changes to galleries/photos
  - Stream to CloudWatch Logs or S3

- [ ] **Optimize DynamoDB indexes**
  - Review GSI usage and costs
  - Remove unused indexes

---

## 🖼️ Image Processing & CDN

### High Priority
- [ ] **Implement actual image processing**
  - Current: Photo processing pipeline exists but not implemented
  - File: Create Lambda function for image processing
  - Tasks:
    - Generate thumbnails (200x200)
    - Generate optimized versions (1920x1080 max)
    - Convert to WebP/AVIF format
    - Extract EXIF metadata

- [ ] **Set up EventBridge + SQS for photo processing**
  - Trigger: S3 upload to original bucket
  - Queue: SQS for processing jobs
  - Lambda: Process images asynchronously
  - File: `infrastructure/lib/stacks/processing-stack.ts` (create this)

- [ ] **Configure CloudFront for production**
  - Current: Basic setup exists
  - Add: Custom domain (photos.yourdomain.com)
  - Add: SSL/TLS certificate
  - Add: Signed URLs for private photos
  - Optimize: Cache behaviors for different content types

- [ ] **Implement signed CloudFront URLs**
  - Current: CDN exists but no signed URLs
  - Purpose: Secure photo access (only authorized clients)
  - File: `backend/internal/services/cdn/` (create this)

### Medium Priority
- [ ] **Add image optimization service**
  - Consider: AWS Lambda + Sharp library
  - Or: Third-party service (Cloudinary, Imgix)

- [ ] **Implement progressive image loading**
  - Frontend: Show low-res placeholder while loading
  - Backend: Generate blur hash or LQIP (Low Quality Image Placeholder)

---

## 🎯 Monitoring & Logging

### High Priority
- [ ] **Set up CloudWatch Alarms**
  - Lambda errors > 1% error rate
  - API Gateway 5xx errors
  - DynamoDB throttling events
  - S3 bucket size approaching limits
  - Lambda cold starts > 3 seconds

- [ ] **Create CloudWatch Dashboard**
  - Key metrics: API requests, error rates, latency
  - Database metrics: Read/write capacity, throttles
  - Storage metrics: Bucket sizes, request counts

- [ ] **Implement structured logging**
  - Current: Basic logging exists
  - Add: Request IDs for tracing
  - Add: Log levels (DEBUG, INFO, WARN, ERROR)
  - Format: JSON for easy parsing

- [ ] **Set up error tracking (Sentry, Rollbar, etc.)**
  - Frontend error tracking
  - Backend error aggregation
  - Alert on critical errors

### Medium Priority
- [ ] **Configure CloudWatch Logs retention**
  - Current: 1 week for Lambda logs
  - Review: Adjust based on compliance needs
  - Recommend: 30 days for prod

- [ ] **Set up AWS X-Ray for distributed tracing**
  - Track requests across Lambda, API Gateway, DynamoDB
  - Identify bottlenecks

- [ ] **Create runbooks for common issues**
  - "What to do when Lambda times out"
  - "How to handle DynamoDB throttling"
  - "Photo processing failures"

---

## 🚀 Performance & Scalability

### High Priority
- [ ] **Optimize Lambda cold starts**
  - Current: 512MB memory, 30s timeout
  - Consider: Increase memory to 1024MB (faster CPU)
  - Consider: Provisioned concurrency for critical functions
  - File: `infrastructure/lib/stacks/api-stack.ts:49`

- [ ] **Implement API response caching**
  - Cache: Gallery listings, photo metadata
  - TTL: 5-60 minutes depending on data
  - Use: API Gateway caching or CloudFront

- [ ] **Add database connection pooling**
  - Go: Reuse DynamoDB client across invocations
  - Current: Creates new client each request
  - Action: Initialize client outside handler

- [ ] **Optimize DynamoDB queries**
  - Review: All queries use indexes (no table scans)
  - Add: Pagination for large result sets
  - Implement: Cursor-based pagination

### Medium Priority
- [ ] **Implement lazy loading for photos**
  - Frontend: Load images as user scrolls
  - Backend: Return paginated results
  - Current: Loads all photos at once

- [ ] **Add HTTP/2 support**
  - API Gateway: Enabled by default
  - CloudFront: Enabled by default
  - Verify: Both are configured correctly

- [ ] **Optimize bundle size**
  - Frontend: Code splitting by route
  - Frontend: Tree shaking unused code
  - Frontend: Lazy load heavy libraries

---

## 💰 Cost Optimization

### High Priority
- [ ] **Set up AWS Cost Explorer and Budgets**
  - Create budget alerts at $50, $100, $200
  - Email notifications when exceeding budget
  - Weekly cost reports

- [ ] **Review and optimize Lambda memory/timeout**
  - Use AWS Lambda Power Tuning tool
  - Find optimal memory size for cost/performance

- [ ] **Implement S3 Intelligent-Tiering**
  - Current: Configured for original bucket
  - Status: ✅ Already implemented
  - Verify: Working correctly in production

- [ ] **Review CloudFront pricing class**
  - Current: PRICE_CLASS_100 (North America + Europe)
  - Action: Adjust based on actual user locations
  - File: `infrastructure/lib/stacks/storage-stack.ts:133`

### Medium Priority
- [ ] **Consider Reserved Capacity for predictable workloads**
  - DynamoDB: If traffic is stable
  - CloudFront: Committed use discounts

- [ ] **Implement photo compression**
  - Reduce storage costs by 50-70%
  - Use: WebP format (better compression than JPEG)

- [ ] **Set up CloudWatch Logs export to S3**
  - Cheaper than keeping in CloudWatch long-term
  - Use S3 lifecycle to archive to Glacier

---

## 🧪 Testing & Quality

### High Priority
- [ ] **Write integration tests**
  - Test: Full authentication flow
  - Test: Gallery CRUD operations
  - Test: Photo upload and retrieval
  - Test: Client session verification

- [ ] **Add E2E tests (Cypress or Playwright)**
  - Test: User registration and login
  - Test: Create gallery workflow
  - Test: Upload photos
  - Test: Client viewing experience

- [ ] **Implement API contract testing**
  - Ensure: Frontend and backend stay in sync
  - Use: OpenAPI/Swagger specs

- [ ] **Set up CI/CD pipeline**
  - Run tests on every commit
  - Automated deployment to staging
  - Manual approval for production
  - Use: GitHub Actions, AWS CodePipeline, or CircleCI

### Medium Priority
- [ ] **Add load testing**
  - Tool: Artillery, k6, or JMeter
  - Test: 1000 concurrent users
  - Identify: Bottlenecks before they hit production

- [ ] **Security testing (penetration testing)**
  - Test: SQL injection, XSS, CSRF
  - Tool: OWASP ZAP, Burp Suite
  - Frequency: Annually or after major changes

- [ ] **Accessibility testing (WCAG compliance)**
  - Tool: axe DevTools, WAVE
  - Ensure: Keyboard navigation works
  - Add: ARIA labels for screen readers

---

## 🌐 Deployment & Infrastructure

### High Priority
- [ ] **Set up production environment**
  - Create: `environment.prod.ts` with production config
  - Update: CDK stage from 'dev' to 'prod'
  - Deploy: Separate AWS account or tight IAM boundaries

- [ ] **Implement blue/green deployment**
  - Zero-downtime deployments
  - Easy rollback if issues arise
  - Use: AWS Lambda aliases and weighted routing

- [ ] **Configure custom domain**
  - Frontend: `app.yourdomain.com` (CloudFront)
  - Backend API: `api.yourdomain.com` (API Gateway)
  - Get SSL certificate from ACM (AWS Certificate Manager)

- [ ] **Set up staging environment**
  - Mirror production setup
  - Test deployments here first
  - Use: Same CDK code, different stage parameter

### Medium Priority
- [ ] **Implement infrastructure monitoring**
  - Track: Stack drift (CDK vs actual resources)
  - Alert: Unexpected infrastructure changes

- [ ] **Document deployment process**
  - Create: DEPLOYMENT.md with step-by-step guide
  - Include: Rollback procedures

- [ ] **Set up disaster recovery plan**
  - Document: RTO (Recovery Time Objective)
  - Document: RPO (Recovery Point Objective)
  - Test: Restore from backup quarterly

---

## 📱 User Experience & Features

### High Priority
- [ ] **Add email verification**
  - Current: Cognito has it, verify it's enabled
  - Send: Welcome email with verification link

- [ ] **Implement password reset flow**
  - Current: Cognito handles this
  - Verify: Works correctly in production
  - Customize: Email templates in Cognito

- [ ] **Add user feedback for errors**
  - Frontend: User-friendly error messages
  - Don't expose: Technical details to users
  - Current: Many errors just log to console

- [ ] **Implement loading states**
  - Add spinners during API calls
  - Skeleton screens for image loading
  - Progress bars for uploads

### Medium Priority
- [ ] **Add multi-factor authentication (MFA)**
  - Cognito: Supports SMS and TOTP
  - Recommended: Optional for users, required for admins

- [ ] **Implement session timeout**
  - Auto-logout after 24 hours
  - Refresh tokens before expiry
  - Show warning before timeout

- [ ] **Add photo upload progress**
  - Show upload percentage
  - Allow cancellation
  - Retry failed uploads

---

## 📊 Analytics & Metrics

### High Priority
- [ ] **Set up analytics tracking**
  - Tool: Google Analytics, Mixpanel, or Amplitude
  - Track: User signups, gallery creations, photo uploads
  - Track: Feature usage, conversion funnels

- [ ] **Implement business metrics dashboard**
  - Metrics: Active users, storage used, galleries created
  - Metrics: Revenue (if applicable), churn rate
  - Tool: Build custom or use AWS QuickSight

### Medium Priority
- [ ] **Add user behavior tracking**
  - Heatmaps: Where users click
  - Session recordings: How users navigate
  - Tool: Hotjar, FullStory, or LogRocket

- [ ] **Set up A/B testing framework**
  - Test different UI/UX approaches
  - Measure conversion impact

---

## 📄 Legal & Compliance

### High Priority
- [ ] **Add Terms of Service**
  - Create `/legal/terms` page
  - Users must accept on signup

- [ ] **Add Privacy Policy**
  - Create `/legal/privacy` page
  - Explain: Data collection, storage, usage
  - GDPR compliance if serving EU users

- [ ] **Implement Cookie Consent Banner**
  - Required: EU GDPR, California CCPA
  - Tool: Cookiebot, OneTrust

- [ ] **Add data deletion capability**
  - Users can request account deletion
  - Delete all associated data (GDPR "right to be forgotten")
  - File: Add endpoint `DELETE /api/v1/users/me`

### Medium Priority
- [ ] **Implement data export**
  - Users can download their data
  - Format: JSON or CSV
  - GDPR requirement

- [ ] **Set up compliance logging**
  - Log: All data access and modifications
  - Retention: As required by regulations

---

## 🛠️ Developer Experience

### High Priority
- [ ] **Complete API documentation**
  - Use: OpenAPI/Swagger
  - Generate: Interactive API docs
  - Include: Request/response examples

- [ ] **Write comprehensive README**
  - Getting started guide
  - Architecture overview
  - Development setup

- [ ] **Create contributing guidelines**
  - Code style guide
  - Pull request process
  - Review checklist

### Medium Priority
- [ ] **Set up linting and formatting**
  - Go: golangci-lint
  - TypeScript: ESLint + Prettier
  - Auto-format on commit (husky + lint-staged)

- [ ] **Add pre-commit hooks**
  - Run tests before commit
  - Check for secrets in code
  - Lint and format

---

## ✅ Quick Wins (Do These First)

1. **Set up AWS budgets and alerts** (15 min)
2. **Enable CloudTrail** (5 min)
3. **Add basic CloudWatch alarms** (30 min)
4. **Update CORS for production domain** (5 min)
5. **Remove JWT secret fallback** (10 min)
6. **Add Terms of Service and Privacy Policy pages** (2-4 hours)

---

## 📈 Estimated Timeline

- **MVP Production (Minimal)**: 2-3 weeks (High Priority items only)
- **Production Ready**: 4-6 weeks (High + Medium Priority)
- **Fully Polished**: 8-12 weeks (All items)

---

## 🎯 Current Status

Last Updated: 2025-12-28

**Completed:**
- ✅ Basic authentication (Cognito)
- ✅ Database schema (DynamoDB)
- ✅ Storage infrastructure (S3 + CloudFront)
- ✅ API endpoints (CRUD for galleries, photos)
- ✅ Frontend application (Angular)
- ✅ AWS deployment (CDK)
- ✅ Basic security (gitignore, no hardcoded secrets)

**In Progress:**
- 🟡 Image processing pipeline (infrastructure exists, needs implementation)
- 🟡 Monitoring and logging (basic setup, needs alarms)

**Not Started:**
- ⚪ Most production hardening tasks above

---

## 📝 Notes

- Review this checklist monthly
- Add new items as requirements change
- Mark items complete with date: `- [x] Item name (2025-12-28)`
- Prioritize based on business needs
