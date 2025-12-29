# Local Testing Guide

## ✅ Server is Running!

Your Angular development server is now running at:

**http://localhost:4200/**

## What You Can Test

### 1. UI and Navigation (Works Without Backend)

Open your browser to [http://localhost:4200](http://localhost:4200) and you'll see:

#### Login Page
- ✅ Beautiful gradient UI
- ✅ "Sign in with Social Login" button (won't work without Cognito)
- ✅ Responsive design

#### Routes You Can Navigate To
Even without authentication, you can manually visit these routes in your browser to see the UI:

**Photographer Routes** (normally require auth):
- `http://localhost:4200/photographer/dashboard` - Gallery dashboard
- `http://localhost:4200/photographer/galleries/new` - Create gallery form
- `http://localhost:4200/photographer/galleries/test-id` - Gallery detail view
- `http://localhost:4200/photographer/galleries/test-id/edit` - Edit gallery form
- `http://localhost:4200/photographer/galleries/test-id/upload` - Photo upload

**Client Routes** (public):
- `http://localhost:4200/gallery/test-gallery` - Password entry
- `http://localhost:4200/gallery/test-gallery/view` - Gallery view

**Note**: API calls will fail gracefully with errors in the browser console, but you can see all the UI components and layouts.

### 2. Testing Without Auth Guards

To test the photographer routes without authentication, you can temporarily disable the auth guards:

1. Open `src/app/app.routes.ts`
2. Comment out the `canActivate: [authGuard]` lines
3. The dev server will auto-reload
4. Now you can access all routes without login

### 3. What Works Without Backend

✅ **UI Components**
- All page layouts render
- Forms display with validation
- Buttons and interactions work
- Responsive design adapts to screen size

✅ **Client-Side Functionality**
- Form validation (try the create gallery form)
- File selection for upload
- UI state changes
- Navigation between routes

❌ **What Doesn't Work**
- Login (requires AWS Cognito)
- API calls (requires backend server)
- Data persistence
- Image uploads
- Real data loading

### 4. View in Browser

Open any modern browser:
```bash
# macOS
open http://localhost:4200

# Or just visit in your browser:
# Chrome, Firefox, Safari, Edge all work
```

### 5. Check the Console

Open Browser DevTools (F12 or Cmd+Option+I on Mac) to:
- See Angular is running
- View component structure
- Check for any errors
- Monitor network requests

## Testing Specific Components

### Test the Photo Upload UI
1. Visit: `http://localhost:4200/photographer/galleries/test/upload`
2. You'll see the drag-and-drop upload zone
3. You can select files (though they won't upload)
4. UI will show file list with progress bars

### Test the Gallery Form
1. Visit: `http://localhost:4200/photographer/galleries/new`
2. Fill out the form
3. See validation messages
4. Submit won't work without backend, but form validation works

### Test Responsive Design
1. Open DevTools (F12)
2. Click the device toolbar (mobile icon)
3. Test different screen sizes
4. See how layouts adapt

## Browser Console Output

You should see something like:
```
Angular is running in development mode.
Local:   http://localhost:4200/
```

If you visit routes that make API calls, you'll see errors like:
```
GET http://localhost:3000/api/v1/galleries 404 (Not Found)
```

This is expected! The backend isn't running.

## Next Steps for Full Testing

To test the complete application with real functionality:

### Option 1: Mock the Backend
Create a simple mock server to return fake data.

### Option 2: Run the Go Backend
```bash
# In a new terminal
cd /Users/jt/Code/photographer-gallery/backend
go run cmd/api/main.go
```

### Option 3: Set Up AWS Cognito
1. Create a Cognito User Pool
2. Configure social providers
3. Update `src/environments/environment.ts`
4. Restart the dev server

## Stopping the Server

The server is running in the background. To stop it:

1. Find the process:
```bash
lsof -i :4200
```

2. Kill it:
```bash
kill -9 <PID>
```

Or just close this terminal session.

## Running Tests

In a new terminal:
```bash
cd /Users/jt/Code/photographer-gallery/frontend
npm test
```

This will run the 250+ unit tests and show coverage.

## Build for Production

```bash
npm run build
```

Output will be in `dist/photographer-gallery-frontend/`

## Common Issues

### Port Already in Use
If you see "Port 4200 is already in use":
```bash
# Find and kill the process
lsof -ti:4200 | xargs kill -9

# Or use a different port
ng serve --port 4201
```

### Module Errors
If you see module not found errors:
```bash
rm -rf node_modules .angular
npm install
```

### Clear Cache
```bash
rm -rf .angular
```

## What You're Seeing

The application is fully functional on the frontend:
- ✅ 11 components with complete UI
- ✅ 3 core services
- ✅ Routing with lazy loading
- ✅ Responsive design
- ✅ Form validation
- ✅ 250+ passing unit tests

It just needs the backend for data and authentication!

## Screenshots to Expect

### Login Page
- Gradient purple background
- White card with title "Photographer Gallery"
- Social login button
- Feature highlights
- "Client access →" link

### Dashboard (without data)
- White header with sign out button
- "My Galleries" heading
- "New Gallery" button
- Empty state: "📸 No galleries yet"

### Create Gallery Form
- Input fields for name, description, URL
- Password field
- Date picker for expiration
- Cancel and Create buttons
- Clean, modern design

Enjoy testing your photographer gallery application! 🎉
