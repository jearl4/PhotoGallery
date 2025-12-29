package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"photographer-gallery/backend/internal/api/handlers"
	"photographer-gallery/backend/internal/api/middleware"
	appConfig "photographer-gallery/backend/internal/config"
	"photographer-gallery/backend/internal/domain/auth"
	"photographer-gallery/backend/internal/domain/gallery"
	"photographer-gallery/backend/internal/domain/photo"
	dynamodbRepo "photographer-gallery/backend/internal/repository/dynamodb"
	cognitoAuth "photographer-gallery/backend/internal/services/auth"
	"photographer-gallery/backend/internal/services/storage"
	"photographer-gallery/backend/pkg/logger"
)

type LocalApp struct {
	// Handlers
	galleryHandler *handlers.GalleryHandler
	photoHandler   *handlers.PhotoHandler
	clientHandler  *handlers.ClientHandler

	// Middleware
	authMiddleware    *middleware.AuthMiddleware
	sessionMiddleware *middleware.SessionMiddleware

	// Services
	authService *cognitoAuth.Service

	// Config
	config *appConfig.Config
}

func main() {
	app, err := initializeLocalApp()
	if err != nil {
		logger.Error("Failed to initialize app", map[string]interface{}{"error": err.Error()})
		os.Exit(1)
	}

	// Set up HTTP server
	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	})

	// API routes - wrap with CORS middleware
	mux.HandleFunc("/api/v1/", app.corsMiddleware(app.router))

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	logger.Info("Starting local development server", map[string]interface{}{
		"port": port,
		"url":  fmt.Sprintf("http://localhost:%s", port),
	})

	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func initializeLocalApp() (*LocalApp, error) {
	ctx := context.Background()

	// Load configuration
	cfg := appConfig.Load()

	logger.Info("Application initialized", map[string]interface{}{
		"region": cfg.AWSRegion,
		"stage":  cfg.APIStage,
	})

	// Load AWS config
	awsCfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(cfg.AWSRegion))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Initialize AWS clients
	dynamoClient := dynamodb.NewFromConfig(awsCfg)
	s3Client := s3.NewFromConfig(awsCfg)

	// Initialize repositories
	galleryRepo := dynamodbRepo.NewGalleryRepository(
		dynamoClient,
		fmt.Sprintf("%s-galleries-%s", cfg.DynamoDBTablePrefix, cfg.APIStage),
	)
	photoRepo := dynamodbRepo.NewPhotoRepository(
		dynamoClient,
		fmt.Sprintf("%s-photos-%s", cfg.DynamoDBTablePrefix, cfg.APIStage),
	)
	favoriteRepo := dynamodbRepo.NewFavoriteRepository(
		dynamoClient,
		fmt.Sprintf("%s-favorites-%s", cfg.DynamoDBTablePrefix, cfg.APIStage),
	)
	sessionRepo := dynamodbRepo.NewClientSessionRepository(
		dynamoClient,
		fmt.Sprintf("%s-sessions-%s", cfg.DynamoDBTablePrefix, cfg.APIStage),
	)

	// Initialize services
	storageService := storage.NewService(
		s3Client,
		cfg.S3BucketOriginal,
		cfg.S3BucketOptimized,
		cfg.S3BucketThumbnail,
		time.Duration(cfg.SignedURLExpiration)*time.Hour,
	)

	galleryService := gallery.NewService(galleryRepo, photoRepo)
	photoService := photo.NewService(photoRepo, favoriteRepo, storageService)
	authService := cognitoAuth.NewService(
		cfg.CognitoUserPoolID,
		cfg.CognitoClientID,
		cfg.AWSRegion,
	)
	clientAuthService := auth.NewClientAuthService(sessionRepo)

	// Initialize handlers
	galleryHandler := handlers.NewGalleryHandler(galleryService, storageService)
	photoHandler := handlers.NewPhotoHandler(photoService)
	clientHandler := handlers.NewClientHandler(galleryService, photoService, clientAuthService)

	// Initialize middleware
	authMiddleware := middleware.NewAuthMiddleware(authService, cfg.JWTSecret)
	sessionMiddleware := middleware.NewSessionMiddleware(clientAuthService)

	return &LocalApp{
		galleryHandler:    galleryHandler,
		photoHandler:      photoHandler,
		clientHandler:     clientHandler,
		authMiddleware:    authMiddleware,
		sessionMiddleware: sessionMiddleware,
		authService:       authService,
		config:            cfg,
	}, nil
}

// CORS middleware for local development
func (app *LocalApp) corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Allow requests from Angular dev server
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:4200")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// Main router
func (app *LocalApp) router(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1")

	// Route matching
	switch {
	// Gallery routes (photographer - requires auth)
	case path == "/galleries" && r.Method == "GET":
		app.withAuth(app.galleryHandler.ListGalleries)(w, r)
	case path == "/galleries" && r.Method == "POST":
		app.withAuth(app.galleryHandler.CreateGallery)(w, r)
	case strings.HasPrefix(path, "/galleries/") && !strings.Contains(path, "/photos"):
		galleryID := strings.TrimPrefix(path, "/galleries/")
		if strings.Contains(galleryID, "/") {
			parts := strings.Split(galleryID, "/")
			galleryID = parts[0]
		}
		switch r.Method {
		case "GET":
			app.withAuth(app.galleryHandler.GetGallery)(w, r)
		case "PUT":
			app.withAuth(app.galleryHandler.UpdateGallery)(w, r)
		case "DELETE":
			app.withAuth(app.galleryHandler.DeleteGallery)(w, r)
		}

	// Photo routes (photographer - requires auth)
	case strings.HasPrefix(path, "/galleries/") && strings.Contains(path, "/photos/upload-url"):
		app.withAuth(app.photoHandler.GetUploadURL)(w, r)
	case strings.HasPrefix(path, "/galleries/") && strings.Contains(path, "/photos") && !strings.Contains(path, "/favorites"):
		if r.Method == "GET" {
			app.withAuth(app.photoHandler.ListPhotos)(w, r)
		} else if r.Method == "DELETE" {
			app.withAuth(app.photoHandler.DeletePhoto)(w, r)
		}
	case strings.HasPrefix(path, "/galleries/") && strings.Contains(path, "/favorites"):
		app.withAuth(app.photoHandler.GetFavorites)(w, r)

	// Client routes (public or session-based)
	case path == "/client/verify" && r.Method == "POST":
		app.clientHandler.VerifyPassword(w, r)
	case strings.HasPrefix(path, "/client/galleries/"):
		urlParts := strings.Split(strings.TrimPrefix(path, "/client/galleries/"), "/")
		customURL := urlParts[0]
		if len(urlParts) == 1 {
			// Get gallery by custom URL
			app.withSession(app.clientHandler.GetGalleryByURL)(w, r)
		} else if urlParts[1] == "photos" {
			// List photos
			app.withSession(app.clientHandler.ListPhotos)(w, r)
		}
	case strings.HasPrefix(path, "/client/photos/") && strings.Contains(path, "/favorite"):
		app.withSession(app.clientHandler.ToggleFavorite)(w, r)
	case strings.HasPrefix(path, "/client/photos/") && strings.Contains(path, "/download-url"):
		app.withSession(app.clientHandler.GetDownloadURL)(w, r)
	case path == "/client/session/favorites":
		app.withSession(app.clientHandler.GetSessionFavorites)(w, r)

	default:
		http.NotFound(w, r)
	}
}

// Helper to wrap handlers with auth middleware
func (app *LocalApp) withAuth(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract user ID from auth header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// For local dev, you can bypass actual token validation
		// In production, this would validate the JWT
		handler(w, r)
	}
}

// Helper to wrap handlers with session middleware
func (app *LocalApp) withSession(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract session token from auth header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		handler(w, r)
	}
}
