package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"photographer-gallery/backend/internal/api/handlers"
	appConfig "photographer-gallery/backend/internal/config"
	"photographer-gallery/backend/internal/domain/gallery"
	dynamodbRepo "photographer-gallery/backend/internal/repository/dynamodb"
	"photographer-gallery/backend/internal/services/auth"
	"photographer-gallery/backend/internal/services/storage"
	"photographer-gallery/backend/pkg/logger"
)

type App struct {
	galleryHandler *handlers.GalleryHandler
	authService    *auth.Service
	config         *appConfig.Config
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

	// Initialize services
	_ = storage.NewService(
		s3Client,
		cfg.S3BucketOriginal,
		cfg.S3BucketOptimized,
		cfg.S3BucketThumbnail,
		time.Duration(cfg.SignedURLExpiration)*time.Hour,
	)

	galleryService := gallery.NewService(galleryRepo, nil) // photoRepo will be added later

	authService := auth.NewService(cfg.CognitoUserPoolID, cfg.CognitoRegion)

	// Initialize handlers
	galleryHandler := handlers.NewGalleryHandler(galleryService)

	logger.Info("Application initialized", map[string]interface{}{
		"stage":  cfg.APIStage,
		"region": cfg.AWSRegion,
	})

	return &App{
		galleryHandler: galleryHandler,
		authService:    authService,
		config:         cfg,
	}, nil
}

func (app *App) handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	logger.Info("Received request", map[string]interface{}{
		"method": req.HTTPMethod,
		"path":   req.Path,
	})

	// Route the request
	response, err := app.route(ctx, req)
	if err != nil {
		logger.Error("Request failed", map[string]interface{}{"error": err.Error()})
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       `{"error": "Internal server error"}`,
			Headers: map[string]string{
				"Content-Type":                "application/json",
				"Access-Control-Allow-Origin": "*",
			},
		}, nil
	}

	return response, nil
}

func (app *App) route(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Simple router - in production use a proper router library
	path := req.Path
	method := req.HTTPMethod

	// Health check
	if path == "/health" && method == "GET" {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusOK,
			Body:       `{"status": "healthy"}`,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
		}, nil
	}

	// All other routes require authentication (except client routes)
	if !startsWithAny(path, "/api/v1/client/") {
		// Verify token
		authHeader := req.Headers["Authorization"]
		if authHeader == "" {
			authHeader = req.Headers["authorization"]
		}

		token, err := auth.ExtractToken(authHeader)
		if err != nil {
			return unauthorizedResponse(), nil
		}

		claims, err := app.authService.VerifyToken(ctx, token)
		if err != nil {
			return unauthorizedResponse(), nil
		}

		// Add user ID to context
		ctx = context.WithValue(ctx, "userID", claims.CognitoUsername)
	}

	// Route to handlers
	// This is a simplified routing - production would use a router
	switch {
	case path == "/api/v1/galleries" && method == "POST":
		return app.handleGalleryCreate(ctx, req)
	case path == "/api/v1/galleries" && method == "GET":
		return app.handleGalleryList(ctx, req)
	// Add more routes here
	default:
		return notFoundResponse(), nil
	}
}

func (app *App) handleGalleryCreate(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// This is simplified - would need proper request/response handling
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Body:       `{"message": "Gallery created"}`,
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
	}, nil
}

func (app *App) handleGalleryList(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Body:       `{"galleries": []}`,
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
	}, nil
}

func unauthorizedResponse() events.APIGatewayProxyResponse {
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusUnauthorized,
		Body:       `{"error": "Unauthorized"}`,
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
	}
}

func notFoundResponse() events.APIGatewayProxyResponse {
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusNotFound,
		Body:       `{"error": "Not found"}`,
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
	}
}

func startsWithAny(s string, prefixes ...string) bool {
	for _, prefix := range prefixes {
		if len(s) >= len(prefix) && s[:len(prefix)] == prefix {
			return true
		}
	}
	return false
}
