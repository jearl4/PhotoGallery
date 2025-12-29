# 🚀 Quick Start Guide - Local Testing

## Problem: The Go backend requires AWS Lambda environment

The backend is built for AWS Lambda deployment and cannot run locally without AWS infrastructure (DynamoDB, S3, Cognito, etc.).

## Solution: Use the Mock API Server

I've created a simple Node.js mock server that implements all the API endpoints so you can test the frontend locally.

---

## ✅ Commands to Run the App Locally

### Terminal 1: Start Mock Backend

```bash
cd /Users/jt/Code/photographer-gallery/mock-server
node server.js
```

You should see:
```
🎉 Mock API Server Started!
📍 URL: http://localhost:3000
✨ Ready to serve your frontend!
```

### Terminal 2: Start Angular Frontend

```bash
cd /Users/jt/Code/photographer-gallery/frontend
npm start
```

You should see:
```
✔ Browser application bundle generation complete.
➜  Local:   http://localhost:4200/
```

### Open Your Browser

Navigate to: **http://localhost:4200**

---

## 🎯 What You Can Test

### ✅ Works Out of the Box

1. **View Login Page** - Beautiful UI with gradients
2. **Navigate to Dashboard** - http://localhost:4200/photographer/dashboard
3. **See Mock Galleries** - 2 pre-loaded sample galleries
4. **Create New Gallery** - http://localhost:4200/photographer/galleries/new
5. **View Gallery Details** - Click on any gallery
6. **Client Gallery Access** - http://localhost:4200/gallery/wedding-2025
   - Password: `password`
7. **View Photos** - See mock photo placeholders
8. **Toggle Favorites** - Click hearts on photos

### ⚠️ Limitations (Without AWS)

- ❌ Social Login (requires AWS Cognito)
- ❌ Real Photo Uploads (mock URLs returned)
- ❌ Persistent Data (resets when server restarts)

---

## 📱 Testing Flow

### Test Photographer Flow

1. Go to: http://localhost:4200/photographer/dashboard
2. See 2 sample galleries displayed
3. Click "New Gallery" button
4. Fill out the form:
   - Name: "My Test Gallery"
   - Description: "Testing locally"
   - Custom URL: "my-test"
   - Password: "test123"
5. Click "Create Gallery"
6. See new gallery in list!

### Test Client Flow

1. Go to: http://localhost:4200/gallery/wedding-2025
2. Enter password: `password`
3. Click "Access Gallery"
4. See photo grid
5. Click heart icon to favorite photos
6. Switch to "Favorites" view

---

## 🔍 Verify Everything is Working

### Check Mock Server

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"healthy","message":"Mock API Server Running"}
```

### Check Frontend

Open: http://localhost:4200

You should see a purple gradient login page.

### Check API Calls

Open browser DevTools (F12) → Network tab

Navigate to dashboard. You should see:
- `GET /api/v1/galleries` → 200 OK

---

## 🛠️ Troubleshooting

### Mock Server Won't Start

**Error**: `Address already in use`

**Solution**:
```bash
# Find process on port 3000
lsof -ti:3000 | xargs kill -9

# Then restart
node server.js
```

### Frontend Won't Start

**Error**: `Port 4200 is already in use`

**Solution**:
```bash
# Find and kill process
lsof -ti:4200 | xargs kill -9

# Then restart
npm start
```

### Can't See Galleries

1. Check mock server is running (Terminal 1)
2. Check console for errors (F12)
3. Verify CORS headers in Network tab
4. Restart both servers

### Node.js Not Installed

Install Node.js:
```bash
# Using Homebrew
brew install node

# Or download from https://nodejs.org
```

---

## 📊 Mock Data Available

### Galleries
- **Sample Wedding Gallery** (24 photos, active)
  - Custom URL: `wedding-2025`
  - Password: `password`

- **Portrait Session** (12 photos, expires in 30 days)
  - Custom URL: `portraits-jan`
  - Password: `password`

### Photos
- Sample placeholder images from placeholder.com
- Different colors for variety
- Mock metadata (size, dimensions)

---

## 🎨 What You'll See

### Dashboard
- Header with "Photographer Gallery"
- "New Gallery" button
- Grid of 2 sample galleries
- Photo counts, view counts
- Status badges (Active/Expires)

### Gallery Detail
- Gallery name and description
- Statistics (photos, views, favorites)
- Gallery URL
- Edit and Upload buttons
- Photo grid (if gallery has photos)

### Client View
- Password entry form
- Photo grid
- Favorite toggle
- View mode switcher (All/Favorites)

---

## 🔄 Resetting Data

To reset to original mock data:
1. Stop the mock server (Ctrl+C)
2. Restart it: `node server.js`

All changes are in-memory only!

---

## 📝 Testing Checklist

- [ ] Mock server starts on port 3000
- [ ] Frontend starts on port 4200
- [ ] Login page loads
- [ ] Dashboard shows 2 galleries
- [ ] Can create new gallery
- [ ] Can view gallery details
- [ ] Can access client gallery with password
- [ ] Can view photos
- [ ] Can toggle favorites
- [ ] No CORS errors in console

---

## 🚦 Next Steps

Once you're happy with the frontend:

### Option 1: Deploy to AWS (Production)
- Set up AWS infrastructure (DynamoDB, S3, Cognito, Lambda)
- Deploy the actual Go backend
- Configure environment variables
- Deploy frontend to S3/CloudFront

### Option 2: Build Different Backend
- Keep the frontend as-is
- Build a Node.js/Express backend
- Use PostgreSQL instead of DynamoDB
- Use regular file uploads instead of S3

### Option 3: Continue with Mock
- Enhance the mock server
- Add more features
- Use for demos and presentations

---

## 💡 Pro Tips

1. **Keep terminals visible** - Easy to see logs
2. **Browser DevTools** - Monitor network requests
3. **Multiple galleries** - Create several to test pagination
4. **Different passwords** - Test client access with various passwords
5. **Responsive testing** - Resize browser or use device emulator

---

## ✨ You're All Set!

Both servers should now be running:
- **Backend**: http://localhost:3000 ✅
- **Frontend**: http://localhost:4200 ✅

Open your browser and start testing! 🎉
