# Security Best Practices

## ✅ What's Safe to Commit to Git

### Frontend Configuration (PUBLIC - Safe to Commit)

The following values in `frontend/src/environments/environment.ts` are **safe to commit**:

- ✅ **API Gateway URL** - Public endpoint (already exposed in browser)
- ✅ **Cognito User Pool ID** - Public identifier (not a secret)
- ✅ **Cognito Client ID** - Public OAuth client ID (designed to be public)
- ✅ **Cognito Domain** - Public OAuth domain
- ✅ **AWS Region** - Public information

**Why these are safe:**
- These values are used in frontend JavaScript which runs in the browser
- Anyone can inspect your website and see these values in the Network tab
- Cognito is designed to have public Client IDs (no Client Secret in frontend)
- AWS verifies requests server-side, not based on these IDs

### Example of Safe Frontend Config:
```typescript
export const environment = {
  production: false,
  apiUrl: 'https://74a9ywmam2.execute-api.us-east-1.amazonaws.com/dev/api/v1',
  cognitoUserPoolId: 'us-east-1_skL0izDwY',
  cognitoClientId: '4k3ie52do1r6h3a44psong3kdh',
  cognitoRegion: 'us-east-1',
  cognitoDomain: 'photographer-gallery-dev-01832951',
};
```

## 🔒 What's NEVER Safe to Commit

### Never Commit These:

- ❌ **AWS Access Keys** (`AKIA...` or `AWS_ACCESS_KEY_ID`)
- ❌ **AWS Secret Keys** (`AWS_SECRET_ACCESS_KEY`)
- ❌ **Private API Keys** (third-party services)
- ❌ **JWT Secrets** (used for signing tokens)
- ❌ **Database Passwords**
- ❌ **OAuth Client Secrets** (backend only)
- ❌ **Encryption Keys**
- ❌ **`.env` files** with secrets
- ❌ **Service Account JSON files**

## 🛡️ How Your App is Secured

### 1. AWS Credentials

**Where they're stored:**
- On your local machine: `~/.aws/credentials` (gitignored)
- In AWS Lambda: Environment variables set by CDK (never in code)

**How to use them:**
```bash
# Configure once per machine
aws configure
# Enter: Access Key, Secret Key, Region

# CDK and AWS SDK automatically use these credentials
# No need to put them in code!
```

### 2. Backend Secrets

**JWT Secret (for client sessions):**
```typescript
// In infrastructure/lib/stacks/api-stack.ts
environment: {
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
}
```

**For production:**
```bash
# Set environment variable before deploy
export JWT_SECRET="your-strong-random-secret"
npx cdk deploy
```

**Better approach (AWS Secrets Manager):**
```typescript
// TODO: Migrate to AWS Secrets Manager
const secret = secretsmanager.Secret.fromSecretNameV2(this, 'JWTSecret', 'jwt-secret');
environment: {
  JWT_SECRET: secret.secretValue.toString(),
}
```

### 3. Cognito Security

**How it works:**
- Frontend has **public Client ID** (safe to expose)
- Cognito **Hosted UI** handles password input (never touches your code)
- Backend verifies **JWT tokens** with Cognito's public keys
- No secrets stored in frontend

**OAuth Flow:**
```
1. User → Cognito Hosted UI (username/password)
2. Cognito → Redirect with auth code
3. Frontend → Exchange code for tokens (no secret needed for public clients)
4. Backend → Verify tokens with Cognito (server-side)
```

## 📁 .gitignore Protection

Your `.gitignore` currently protects:

```gitignore
# Environment files
.env
.env.local
.env.*.local
.env.production

# Certificates and keys
*.pem
*.key
*.p8
*.cert
*.p12

# AWS credentials
.aws/
cdk.context.json  # May contain account IDs

# Any files with these patterns
*credentials*
*secret*
```

## 🔍 How to Check for Leaked Secrets

### Before Committing:

```bash
# Check what you're about to commit
git status
git diff

# Search for potential secrets
grep -r "AKIA\|sk-\|secret\|password" --include="*.ts" --include="*.go" .

# Check git history (if you accidentally committed)
git log -p | grep -i "secret\|password\|key"
```

### If You Accidentally Commit a Secret:

**❌ DON'T do this:**
```bash
git rm file-with-secret.ts
git commit -m "remove secret"
# Secret is STILL in git history!
```

**✅ DO this:**
```bash
# 1. Rotate the secret immediately (make it invalid)
# 2. Remove from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/file-with-secret" \
  --prune-empty --tag-name-filter cat -- --all

# 3. Force push (if already pushed to remote)
git push origin --force --all
```

## 🎯 Best Practices Summary

### ✅ DO:

1. **Use environment variables** for secrets
2. **Commit public OAuth configs** (Cognito IDs, API URLs)
3. **Use AWS IAM roles** for Lambda (no hardcoded keys)
4. **Store secrets in AWS Secrets Manager** for production
5. **Review `.gitignore` regularly**
6. **Use `git diff` before committing**

### ❌ DON'T:

1. **Hardcode AWS access keys** anywhere
2. **Commit `.env` files**
3. **Put secrets in frontend code** (visible to users)
4. **Share production credentials** in code
5. **Commit service account JSON files**

## 📚 Additional Resources

- [AWS Security Best Practices](https://aws.amazon.com/architecture/security-identity-compliance/)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)

## 🚨 What to Do if Secrets are Leaked

1. **Immediately rotate the secret** (make it invalid)
2. **Remove from git history** (see above)
3. **Check CloudTrail** for unauthorized usage
4. **Enable AWS GuardDuty** for threat detection
5. **Review IAM permissions** for compromised accounts
6. **Force password reset** if user credentials leaked

## 🔐 Current Security Status

✅ **No hardcoded AWS credentials** in source code
✅ **Frontend configs are public-safe** (Cognito design)
✅ **`.gitignore` protects sensitive files**
✅ **AWS SDK uses IAM roles** (no keys in Lambda)
✅ **JWT secrets use environment variables**

⚠️ **Recommended improvements:**
- Migrate JWT_SECRET to AWS Secrets Manager
- Enable AWS GuardDuty for threat monitoring
- Set up CloudTrail for audit logging
- Implement secret rotation policies
