# Mock API Server

This is a simple Node.js server that mocks the backend API so you can test the frontend without AWS infrastructure.

## Quick Start

```bash
# Navigate to mock-server directory
cd /Users/jt/Code/photographer-gallery/mock-server

# Start the server
node server.js
```

The server will start on **http://localhost:3000**

## Features

✅ No dependencies required (uses only Node.js built-in modules)
✅ CORS configured for http://localhost:4200
✅ Mock data for galleries and photos
✅ In-memory storage (resets on restart)
✅ All main API endpoints implemented

## Mock Data

The server comes with 2 sample galleries pre-loaded:
- "Sample Wedding Gallery" (24 photos)
- "Portrait Session" (12 photos)

## Client Password

For testing client gallery access, use:
- **Password**: `password`

## Available Endpoints

### Photographer Routes
- `GET /api/v1/galleries` - List all galleries
- `POST /api/v1/galleries` - Create gallery
- `GET /api/v1/galleries/:id` - Get gallery
- `PUT /api/v1/galleries/:id` - Update gallery
- `DELETE /api/v1/galleries/:id` - Delete gallery
- `GET /api/v1/galleries/:id/photos` - List photos
- `POST /api/v1/galleries/:id/photos/upload-url` - Get upload URL
- `DELETE /api/v1/galleries/:id/photos/:photoId` - Delete photo

### Client Routes
- `POST /api/v1/client/verify` - Verify gallery password
- `GET /api/v1/client/galleries/:customUrl` - Get gallery
- `GET /api/v1/client/galleries/:customUrl/photos` - List photos
- `POST /api/v1/client/photos/:photoId/favorite` - Toggle favorite

### Utility
- `GET /health` - Health check

## Testing with Frontend

1. Start the mock server:
   ```bash
   node server.js
   ```

2. Start the Angular frontend (in another terminal):
   ```bash
   cd /Users/jt/Code/photographer-gallery/frontend
   npm start
   ```

3. Open http://localhost:4200

4. **Note**: Since login requires AWS Cognito, you'll need to bypass auth guards temporarily or manually navigate to routes.

## Example API Calls

### Create a Gallery
```bash
curl -X POST http://localhost:3000/api/v1/galleries \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Test Gallery",
    "description": "Testing the API",
    "customUrl": "test-gallery",
    "password": "secret123"
  }'
```

### Verify Gallery Password (Client)
```bash
curl -X POST http://localhost:3000/api/v1/client/verify \
  -H "Content-Type: application/json" \
  -d '{
    "customUrl": "wedding-2025",
    "password": "password"
  }'
```

## Limitations

- ⚠️ No actual AWS Cognito authentication
- ⚠️ No actual file uploads (returns mock URLs)
- ⚠️ Data resets when server restarts
- ⚠️ No actual image processing
- ⚠️ Simplified auth (any Bearer token accepted)

## Logs

The server logs all requests to console:
```
GET /api/v1/galleries
POST /api/v1/galleries
```

## Stopping the Server

Press `Ctrl+C` in the terminal running the server.
