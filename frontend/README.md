# Photographer Gallery - Frontend

Angular 18 frontend application for the photographer gallery platform.

## Prerequisites

- Node.js 18+ and npm
- Angular CLI (will be installed with dependencies)

## Quick Start - Local Development

### 1. Install Dependencies

```bash
cd /Users/jt/Code/photographer-gallery/frontend
npm install
```

### 2. Start Development Server

```bash
npm start
```

The application will be available at [http://localhost:4200](http://localhost:4200)

### 3. Run Tests

```bash
# Run tests in watch mode
npm test

# Run tests once (headless)
npm run test:headless
```

## Testing Without Backend

The application can run locally for UI testing without a backend server. However:

- **Login will not work** (requires Cognito setup)
- **API calls will fail** (requires backend server)
- **UI and routing can be tested** (navigation, forms, components)

### Mock Testing Flow

To test the UI locally without authentication:

1. Comment out the auth guards temporarily in `src/app/app.routes.ts`
2. Navigate directly to routes like `/photographer/dashboard`
3. The UI will render but API calls will fail gracefully

## Configuration

### Environment Files

- `src/environments/environment.ts` - Development (used by `npm start`)
- `src/environments/environment.prod.ts` - Production build (used by `npm run build`)

**Why does `environment.prod.ts` exist if we haven't gone to production?**

Angular's build system requires `environment.prod.ts` to exist when building for production mode:
```bash
npm run build  # Uses environment.prod.ts
```

The `production: true` flag tells Angular to:
- Enable production optimizations (minification, tree-shaking, AOT compilation)
- Disable development warnings and debug info
- Create an optimized bundle

**Current setup**: Both files point to the **dev** backend infrastructure.

**Future production setup**:
1. Deploy separate production infrastructure: `cdk deploy --all --context stage=prod`
2. Update `environment.prod.ts` with production URLs
3. Keep `environment.ts` pointing to dev for local development

### Required Environment Variables

Update both environment files with your AWS deployment outputs:

**For development** (`src/environments/environment.ts`):
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

**For production builds** (`src/environments/environment.prod.ts`):
```typescript
export const environment = {
  production: true,  // Enables Angular optimizations
  apiUrl: 'https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/api/v1',  // Same as dev for now
  cdnUrl: 'https://YOUR-CLOUDFRONT-ID.cloudfront.net',
  cognitoUserPoolId: 'us-east-1_XXXXXXXXX',
  cognitoClientId: 'YOUR-CLIENT-ID',
  cognitoRegion: 'us-east-1',
  cognitoDomain: 'YOUR-COGNITO-DOMAIN',
};
```

Get these values from your CDK deployment outputs:
```bash
aws cloudformation describe-stacks --stack-name PhotographerGalleryApi-dev --query 'Stacks[0].Outputs'
```

## Full Stack Testing

To test with the backend:

### 1. Start the Go Backend

```bash
cd /Users/jt/Code/photographer-gallery/backend
go run cmd/api/main.go
```

The backend should run on `http://localhost:3000`

### 2. Configure AWS Cognito

You'll need to set up a Cognito User Pool:

1. Create a User Pool in AWS Cognito
2. Enable social identity providers (Google, Facebook, Apple)
3. Create an App Client
4. Configure the hosted UI domain
5. Set callback URL to `http://localhost:4200/auth/callback`
6. Update environment files with the Cognito details

### 3. Start Frontend

```bash
npm start
```

Now you can:
- ✅ Login with social providers
- ✅ Create and manage galleries
- ✅ Upload photos
- ✅ Access client galleries

## Available Scripts

- `npm start` - Start development server (port 4200)
- `npm run build` - Build for production
- `npm test` - Run unit tests
- `npm run test:headless` - Run tests in headless mode
- `npm run watch` - Build and watch for changes
- `npm run lint` - Lint code (if configured)

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── core/              # Core services, guards, interceptors
│   │   ├── features/          # Feature modules (auth, photographer, client)
│   │   ├── shared/            # Shared components (photo-grid, lightbox)
│   │   ├── app.component.ts   # Root component
│   │   ├── app.config.ts      # App configuration
│   │   └── app.routes.ts      # Route definitions
│   ├── environments/          # Environment configurations
│   ├── index.html            # HTML entry point
│   ├── main.ts               # Application bootstrap
│   └── styles.css            # Global styles
├── angular.json              # Angular CLI configuration
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript configuration
└── karma.conf.js             # Test configuration
```

## Key Features

### Photographer Portal
- Social login via Cognito
- Gallery management (create, edit, delete)
- Photo upload with drag-and-drop
- Direct S3 uploads via presigned URLs
- View client favorites

### Client Portal
- Password-protected gallery access
- Photo viewing with lightbox
- Favorite photos
- Filter by favorites

### UI Components
- Photo Grid (responsive, configurable)
- Lightbox (keyboard navigation, zoom)
- Loading states
- Error handling
- Form validation

## Development Tips

### Hot Reload
The dev server supports hot module replacement. Changes to TypeScript files will automatically refresh the browser.

### Component Development
Navigate directly to component routes for isolated development:
- Login: `http://localhost:4200/`
- Dashboard: `http://localhost:4200/photographer/dashboard`
- Gallery Form: `http://localhost:4200/photographer/galleries/new`

### Testing Individual Components
Use the component spec files to test in isolation:
```bash
npm test -- --include='**/photo-grid.component.spec.ts'
```

## Build for Production

```bash
npm run build
```

Production files will be in `dist/photographer-gallery-frontend/`

Deploy to:
- AWS S3 + CloudFront
- Vercel
- Netlify
- Any static hosting

## Troubleshooting

### Port Already in Use
If port 4200 is taken:
```bash
ng serve --port 4201
```

### Clear Angular Cache
If you encounter build issues:
```bash
rm -rf .angular
npm install
```

### Module Not Found Errors
Make sure all dependencies are installed:
```bash
rm -rf node_modules package-lock.json
npm install
```

### CORS Errors
If testing with backend, ensure the backend allows `http://localhost:4200` in CORS settings.

## Next Steps

1. ✅ Install dependencies (`npm install`)
2. ✅ Start dev server (`npm start`)
3. ⏳ Set up AWS Cognito (for authentication)
4. ⏳ Start backend server (for API calls)
5. ⏳ Update environment configuration
6. 🎉 Test full application flow

## Test Coverage

The application has 250+ unit tests covering:
- All services (auth, API, client session)
- All components (photographer and client portals)
- All shared components (photo grid, lightbox)
- Edge cases and error scenarios

Run tests to verify:
```bash
npm test
```

## Support

For issues or questions:
1. Check the console for error messages
2. Verify environment configuration
3. Check that backend is running (if testing full stack)
4. Review the IMPLEMENTATION_SUMMARY.md for detailed documentation
