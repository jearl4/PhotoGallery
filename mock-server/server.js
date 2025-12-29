#!/usr/bin/env node

/**
 * Mock API Server for Photographer Gallery Frontend Testing
 *
 * This is a simple Node.js server that mocks the backend API
 * so you can test the frontend without AWS infrastructure.
 *
 * Usage: node server.js
 * Server will run on http://localhost:3000
 */

const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;

// Mock data store
let galleries = [
  {
    galleryId: 'gal_1',
    userId: 'user_123',
    name: 'Sample Wedding Gallery',
    customUrl: 'wedding-2025',
    description: 'Beautiful wedding photos from Sarah & John',
    photoCount: 24,
    clientAccessCount: 15,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active'
  },
  {
    galleryId: 'gal_2',
    userId: 'user_123',
    name: 'Portrait Session',
    customUrl: 'portraits-jan',
    description: 'Family portraits',
    photoCount: 12,
    clientAccessCount: 5,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }
];

let photos = [
  {
    photoId: 'photo_1',
    galleryId: 'gal_1',
    fileName: 'wedding-001.jpg',
    originalUrl: 'https://via.placeholder.com/1920x1080/667eea/ffffff?text=Wedding+Photo+1',
    optimizedUrl: 'https://via.placeholder.com/1200x800/667eea/ffffff?text=Wedding+Photo+1',
    thumbnailUrl: 'https://via.placeholder.com/400x300/667eea/ffffff?text=Wedding+Photo+1',
    uploadedAt: new Date().toISOString(),
    metadata: { width: 1920, height: 1080, size: 2048000, contentType: 'image/jpeg' }
  },
  {
    photoId: 'photo_2',
    galleryId: 'gal_1',
    fileName: 'wedding-002.jpg',
    originalUrl: 'https://via.placeholder.com/1920x1080/764ba2/ffffff?text=Wedding+Photo+2',
    optimizedUrl: 'https://via.placeholder.com/1200x800/764ba2/ffffff?text=Wedding+Photo+2',
    thumbnailUrl: 'https://via.placeholder.com/400x300/764ba2/ffffff?text=Wedding+Photo+2',
    uploadedAt: new Date().toISOString(),
    metadata: { width: 1920, height: 1080, size: 1856000, contentType: 'image/jpeg' }
  }
];

let sessions = new Map();
let favorites = [];

// Helper functions
function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Request handler
const server = http.createServer(async (req, res) => {
  corsHeaders(res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  console.log(`${method} ${path}`);

  try {
    // Gallery routes
    if (path === '/api/v1/galleries' && method === 'GET') {
      sendJSON(res, 200, { galleries });
    }
    else if (path === '/api/v1/galleries' && method === 'POST') {
      const body = await readBody(req);
      const newGallery = {
        galleryId: 'gal_' + Date.now(),
        userId: 'user_123',
        name: body.name,
        customUrl: body.customUrl || `gallery-${Date.now()}`,
        description: body.description,
        photoCount: 0,
        clientAccessCount: 0,
        createdAt: new Date().toISOString(),
        status: 'active',
        expiresAt: body.expiresAt
      };
      galleries.push(newGallery);
      sendJSON(res, 201, newGallery);
    }
    else if (path.match(/^\/api\/v1\/galleries\/([^\/]+)$/) && method === 'GET') {
      const galleryId = path.split('/')[4];
      const gallery = galleries.find(g => g.galleryId === galleryId);
      if (gallery) {
        sendJSON(res, 200, gallery);
      } else {
        sendJSON(res, 404, { error: 'Gallery not found' });
      }
    }
    else if (path.match(/^\/api\/v1\/galleries\/([^\/]+)$/) && method === 'PUT') {
      const galleryId = path.split('/')[4];
      const body = await readBody(req);
      const index = galleries.findIndex(g => g.galleryId === galleryId);
      if (index !== -1) {
        galleries[index] = { ...galleries[index], ...body };
        sendJSON(res, 200, galleries[index]);
      } else {
        sendJSON(res, 404, { error: 'Gallery not found' });
      }
    }
    else if (path.match(/^\/api\/v1\/galleries\/([^\/]+)$/) && method === 'DELETE') {
      const galleryId = path.split('/')[4];
      galleries = galleries.filter(g => g.galleryId !== galleryId);
      sendJSON(res, 204, {});
    }
    // Photos routes
    else if (path.match(/^\/api\/v1\/galleries\/([^\/]+)\/photos$/) && method === 'GET') {
      const galleryId = path.split('/')[4];
      const galleryPhotos = photos.filter(p => p.galleryId === galleryId);
      sendJSON(res, 200, { photos: galleryPhotos });
    }
    else if (path.match(/^\/api\/v1\/galleries\/([^\/]+)\/photos\/upload-url$/) && method === 'POST') {
      const galleryId = path.split('/')[4];
      const body = await readBody(req);
      sendJSON(res, 200, {
        uploadUrl: 'https://mock-s3-url.com/upload',
        photoId: 'photo_' + Date.now(),
        key: `galleries/${galleryId}/${body.fileName}`
      });
    }
    else if (path.match(/^\/api\/v1\/galleries\/([^\/]+)\/photos\/([^\/]+)$/) && method === 'DELETE') {
      const photoId = path.split('/')[6];
      photos = photos.filter(p => p.photoId !== photoId);
      sendJSON(res, 204, {});
    }
    else if (path.match(/^\/api\/v1\/galleries\/([^\/]+)\/favorites$/) && method === 'GET') {
      const galleryId = path.split('/')[4];
      const galleryFavorites = favorites.filter(f => f.galleryId === galleryId);
      sendJSON(res, 200, { favorites: galleryFavorites });
    }
    // Client routes
    else if (path === '/api/v1/client/verify' && method === 'POST') {
      const body = await readBody(req);
      const gallery = galleries.find(g => g.customUrl === body.customUrl);

      if (gallery && body.password === 'password') { // Mock password check
        const sessionToken = 'session_' + Date.now();
        sessions.set(sessionToken, { galleryId: gallery.galleryId });
        sendJSON(res, 200, {
          sessionToken,
          gallery
        });
      } else {
        sendJSON(res, 401, { error: 'Invalid password' });
      }
    }
    else if (path.match(/^\/api\/v1\/client\/galleries\/([^\/]+)$/) && method === 'GET') {
      const customUrl = path.split('/')[5];
      const gallery = galleries.find(g => g.customUrl === customUrl);
      if (gallery) {
        sendJSON(res, 200, gallery);
      } else {
        sendJSON(res, 404, { error: 'Gallery not found' });
      }
    }
    else if (path.match(/^\/api\/v1\/client\/galleries\/([^\/]+)\/photos$/) && method === 'GET') {
      const customUrl = path.split('/')[5];
      const gallery = galleries.find(g => g.customUrl === customUrl);
      if (gallery) {
        const galleryPhotos = photos.filter(p => p.galleryId === gallery.galleryId);
        sendJSON(res, 200, { photos: galleryPhotos });
      } else {
        sendJSON(res, 404, { error: 'Gallery not found' });
      }
    }
    else if (path.match(/^\/api\/v1\/client\/photos\/([^\/]+)\/favorite$/) && method === 'POST') {
      const photoId = path.split('/')[5];
      const existing = favorites.findIndex(f => f.photoId === photoId);

      if (existing !== -1) {
        favorites.splice(existing, 1);
        sendJSON(res, 200, { isFavorited: false });
      } else {
        favorites.push({ photoId, favoritedAt: new Date().toISOString() });
        sendJSON(res, 200, { isFavorited: true });
      }
    }
    else if (path === '/api/v1/client/session/favorites' && method === 'GET') {
      sendJSON(res, 200, { favorites });
    }
    // Health check
    else if (path === '/health') {
      sendJSON(res, 200, { status: 'healthy', message: 'Mock API Server Running' });
    }
    else {
      sendJSON(res, 404, { error: 'Route not found', path, method });
    }
  } catch (error) {
    console.error('Error:', error);
    sendJSON(res, 500, { error: 'Internal server error', message: error.message });
  }
});

server.listen(PORT, () => {
  console.log('\n🎉 Mock API Server Started!');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
  console.log(`🌐 CORS: Configured for http://localhost:4200\n`);
  console.log('Available Routes:');
  console.log('  GET    /api/v1/galleries');
  console.log('  POST   /api/v1/galleries');
  console.log('  GET    /api/v1/galleries/:id');
  console.log('  PUT    /api/v1/galleries/:id');
  console.log('  DELETE /api/v1/galleries/:id');
  console.log('  GET    /api/v1/galleries/:id/photos');
  console.log('  POST   /api/v1/client/verify');
  console.log('\n✨ Ready to serve your frontend!\n');
});
