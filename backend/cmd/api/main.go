package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
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

type App struct {
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
	app, err := initializeApp()
	if err != nil {
		logger.Error("Failed to initialize app", map[string]interface{}{"error": err.Error()})
		os.Exit(1)
	}

	lambda.Start(app.handler)
}

func initializeApp() (*App, error) {
	ctx := context.Background()

	// Load configuration
	cfg := appConfig.Load()

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
	photoService := photo.NewService(photoRepo, galleryRepo, favoriteRepo, storageService)

	// Generate JWT secret for sessions (in production, use AWS Secrets Manager)
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "default-secret-change-in-production"
		logger.Warn("Using default JWT secret - set JWT_SECRET environment variable", nil)
	}
	sessionService := auth.NewSessionService(sessionRepo, jwtSecret, cfg.SessionTTLHours)

	authService := cognitoAuth.NewService(cfg.CognitoUserPoolID, cfg.CognitoRegion)

	// Initialize handlers
	galleryHandler := handlers.NewGalleryHandler(galleryService)
	photoHandler := handlers.NewPhotoHandler(photoService)
	clientHandler := handlers.NewClientHandler(galleryService, photoService, sessionService)

	// Initialize middleware
	authMiddleware := middleware.NewAuthMiddleware(authService)
	sessionMiddleware := middleware.NewSessionMiddleware(sessionService)

	logger.Info("Application initialized", map[string]interface{}{
		"stage":  cfg.APIStage,
		"region": cfg.AWSRegion,
	})

	return &App{
		galleryHandler:    galleryHandler,
		photoHandler:      photoHandler,
		clientHandler:     clientHandler,
		authMiddleware:    authMiddleware,
		sessionMiddleware: sessionMiddleware,
		authService:       authService,
		config:            cfg,
	}, nil
}

func (app *App) handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	logger.Info("Received request", map[string]interface{}{
		"method": req.HTTPMethod,
		"path":   req.Path,
	})

	// Handle OPTIONS requests (CORS preflight)
	if req.HTTPMethod == "OPTIONS" {
		return middleware.HandlePreflight(app.config.AllowedOrigins), nil
	}

	// Route the request
	response, err := app.route(ctx, req)
	if err != nil {
		logger.Error("Request failed", map[string]interface{}{"error": err.Error()})
		response = events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       `{"error": "Internal server error"}`,
		}
	}

	// Add CORS headers
	response = middleware.AddCORSHeaders(response, app.config.AllowedOrigins)

	return response, nil
}

func (app *App) route(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	path := req.Path
	method := req.HTTPMethod

	// Health check
	if path == "/health" && method == "GET" {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusOK,
			Body:       `{"status": "healthy"}`,
			Headers:    map[string]string{"Content-Type": "application/json"},
		}, nil
	}

	// Client routes (no photographer auth required)
	if strings.HasPrefix(path, "/api/v1/client/") {
		return app.routeClientRequests(ctx, req)
	}

	// Photographer routes (require authentication)
	return app.routePhotographerRequests(ctx, req)
}

func (app *App) routePhotographerRequests(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Verify photographer token
	authCtx, err := app.authMiddleware.VerifyPhotographerToken(ctx, req)
	if err != nil {
		return unauthorizedResponse(err.Error()), nil
	}

	path := req.Path
	method := req.HTTPMethod

	// Extract path parameters
	ctx = extractPathParams(authCtx, req)

	// Gallery routes
	if path == "/api/v1/galleries" && method == "POST" {
		return invokeHandler(ctx, req, app.galleryHandler.CreateGallery)
	}
	if path == "/api/v1/galleries" && method == "GET" {
		return invokeHandler(ctx, req, app.galleryHandler.ListGalleries)
	}
	if matchPath(path, "/api/v1/galleries/{id}") && method == "GET" {
		return invokeHandler(ctx, req, app.galleryHandler.GetGallery)
	}
	if matchPath(path, "/api/v1/galleries/{id}") && method == "PUT" {
		return invokeHandler(ctx, req, app.galleryHandler.UpdateGallery)
	}
	if matchPath(path, "/api/v1/galleries/{id}") && method == "DELETE" {
		return invokeHandler(ctx, req, app.galleryHandler.DeleteGallery)
	}
	if matchPath(path, "/api/v1/galleries/{id}/expire") && method == "POST" {
		return invokeHandler(ctx, req, app.galleryHandler.SetExpiration)
	}

	// Photo routes
	if matchPath(path, "/api/v1/galleries/{id}/photos/upload-url") && method == "POST" {
		return invokeHandler(ctx, req, app.photoHandler.GetUploadURL)
	}
	if matchPath(path, "/api/v1/galleries/{id}/photos") && method == "GET" {
		return invokeHandler(ctx, req, app.photoHandler.ListPhotos)
	}
	if matchPath(path, "/api/v1/galleries/{galleryId}/photos/{photoId}") && method == "DELETE" {
		return invokeHandler(ctx, req, app.photoHandler.DeletePhoto)
	}
	if matchPath(path, "/api/v1/galleries/{id}/favorites") && method == "GET" {
		return invokeHandler(ctx, req, app.photoHandler.GetFavorites)
	}

	return notFoundResponse(), nil
}

func (app *App) routeClientRequests(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	path := req.Path
	method := req.HTTPMethod

	// Password verification (no auth required)
	if path == "/api/v1/client/verify" && method == "POST" {
		ctx = extractPathParams(ctx, req)
		return invokeHandler(ctx, req, app.clientHandler.VerifyPassword)
	}

	// All other client routes require session token
	sessionCtx, err := app.sessionMiddleware.VerifyClientSession(ctx, req)
	if err != nil {
		return unauthorizedResponse(err.Error()), nil
	}

	ctx = extractPathParams(sessionCtx, req)

	// Client gallery routes
	if matchPath(path, "/api/v1/client/galleries/{customUrl}") && method == "GET" {
		return invokeHandler(ctx, req, app.clientHandler.GetGallery)
	}
	if matchPath(path, "/api/v1/client/galleries/{customUrl}/photos") && method == "GET" {
		return invokeHandler(ctx, req, app.clientHandler.ListPhotos)
	}
	if matchPath(path, "/api/v1/client/photos/{photoId}/download-url") && method == "GET" {
		return invokeHandler(ctx, req, app.clientHandler.GetDownloadURL)
	}
	if matchPath(path, "/api/v1/client/photos/{photoId}/favorite") && method == "POST" {
		return invokeHandler(ctx, req, app.clientHandler.ToggleFavorite)
	}
	if path == "/api/v1/client/session/favorites" && method == "GET" {
		return invokeHandler(ctx, req, app.clientHandler.GetSessionFavorites)
	}

	return notFoundResponse(), nil
}

// Helper functions

type handlerFunc func(http.ResponseWriter, *http.Request)

func invokeHandler(ctx context.Context, req events.APIGatewayProxyRequest, handler handlerFunc) (events.APIGatewayProxyResponse, error) {
	// Create a mock ResponseWriter to capture the response
	rw := &responseWriter{
		statusCode: http.StatusOK,
		headers:    make(map[string]string),
		body:       "",
	}

	// Create HTTP request from API Gateway event
	httpReq, err := requestFromEvent(ctx, req)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusBadRequest,
			Body:       fmt.Sprintf(`{"error": "%s"}`, err.Error()),
		}, nil
	}

	// Call the handler
	handler(rw, httpReq)

	return events.APIGatewayProxyResponse{
		StatusCode: rw.statusCode,
		Headers:    rw.headers,
		Body:       rw.body,
	}, nil
}

func matchPath(path, pattern string) bool {
	// Simple path matching - in production use a proper router
	parts := strings.Split(path, "/")
	patternParts := strings.Split(pattern, "/")

	if len(parts) != len(patternParts) {
		return false
	}

	for i := range parts {
		if strings.HasPrefix(patternParts[i], "{") && strings.HasSuffix(patternParts[i], "}") {
			continue
		}
		if parts[i] != patternParts[i] {
			return false
		}
	}

	return true
}

func extractPathParams(ctx context.Context, req events.APIGatewayProxyRequest) context.Context {
	// Extract path parameters and add to context
	if req.PathParameters != nil {
		for key, value := range req.PathParameters {
			ctx = context.WithValue(ctx, key, value)
		}
	}
	return ctx
}

func requestFromEvent(ctx context.Context, req events.APIGatewayProxyRequest) (*http.Request, error) {
	httpReq, err := http.NewRequestWithContext(ctx, req.HTTPMethod, req.Path, strings.NewReader(req.Body))
	if err != nil {
		return nil, err
	}

	for key, value := range req.Headers {
		httpReq.Header.Set(key, value)
	}

	return httpReq, nil
}

func unauthorizedResponse(message string) events.APIGatewayProxyResponse {
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusUnauthorized,
		Body:       fmt.Sprintf(`{"error": "%s"}`, message),
		Headers:    map[string]string{"Content-Type": "application/json"},
	}
}

func notFoundResponse() events.APIGatewayProxyResponse {
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusNotFound,
		Body:       `{"error": "Not found"}`,
		Headers:    map[string]string{"Content-Type": "application/json"},
	}
}

// responseWriter captures HTTP response for Lambda
type responseWriter struct {
	statusCode int
	headers    map[string]string
	body       string
}

func (rw *responseWriter) Header() http.Header {
	h := make(http.Header)
	for k, v := range rw.headers {
		h.Set(k, v)
	}
	return h
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	rw.body += string(b)
	return len(b), nil
}

func (rw *responseWriter) WriteHeader(statusCode int) {
	rw.statusCode = statusCode
}
