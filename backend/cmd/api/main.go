//go:build !local

package main

import (
	"context"
	"encoding/json"
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

	"photographer-gallery/backend/internal/api"
	"photographer-gallery/backend/internal/api/handlers"
	"photographer-gallery/backend/internal/api/middleware"
	appConfig "photographer-gallery/backend/internal/config"
	"photographer-gallery/backend/internal/domain/auth"
	"photographer-gallery/backend/internal/domain/customdomain"
	"photographer-gallery/backend/internal/domain/gallery"
	"photographer-gallery/backend/internal/domain/photo"
	dynamodbRepo "photographer-gallery/backend/internal/repository/dynamodb"
	cognitoAuth "photographer-gallery/backend/internal/services/auth"
	"photographer-gallery/backend/internal/services/storage"
	"photographer-gallery/backend/pkg/logger"
)

// App holds application dependencies.
type App struct {
	router *api.Router
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
	cfg := appConfig.Load()

	awsCfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(cfg.AWSRegion))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Initialize infrastructure
	dynamoClient := dynamodb.NewFromConfig(awsCfg)
	s3Client := s3.NewFromConfig(awsCfg)

	// Initialize repositories
	repos := initRepositories(dynamoClient, cfg)

	// Initialize services
	services := initServices(s3Client, repos, cfg)

	// Build router with routes and middleware
	router := buildRouter(services, repos, cfg)

	logger.Info("Application initialized", map[string]interface{}{
		"stage":  cfg.APIStage,
		"region": cfg.AWSRegion,
	})

	return &App{router: router, config: cfg}, nil
}

type repositories struct {
	gallery      *dynamodbRepo.GalleryRepository
	photo        *dynamodbRepo.PhotoRepository
	favorite     *dynamodbRepo.FavoriteRepository
	session      *dynamodbRepo.ClientSessionRepository
	photographer *dynamodbRepo.PhotographerRepository
}

func initRepositories(client *dynamodb.Client, cfg *appConfig.Config) *repositories {
	prefix := cfg.DynamoDBTablePrefix
	stage := cfg.APIStage
	return &repositories{
		gallery:      dynamodbRepo.NewGalleryRepository(client, fmt.Sprintf("%s-galleries-%s", prefix, stage)),
		photo:        dynamodbRepo.NewPhotoRepository(client, fmt.Sprintf("%s-photos-%s", prefix, stage)),
		favorite:     dynamodbRepo.NewFavoriteRepository(client, fmt.Sprintf("%s-favorites-%s", prefix, stage)),
		session:      dynamodbRepo.NewClientSessionRepository(client, fmt.Sprintf("%s-sessions-%s", prefix, stage)),
		photographer: dynamodbRepo.NewPhotographerRepository(client, fmt.Sprintf("%s-photographers-%s", prefix, stage)),
	}
}

type services struct {
	gallery *gallery.Service
	photo   *photo.Service
	session *auth.SessionService
	auth    *cognitoAuth.Service
	domain  *customdomain.Service
}

func initServices(s3Client *s3.Client, repos *repositories, cfg *appConfig.Config) *services {
	storageService := storage.NewService(
		s3Client,
		cfg.S3BucketOriginal,
		cfg.S3BucketOptimized,
		cfg.S3BucketThumbnail,
		time.Duration(cfg.SignedURLExpiration)*time.Hour,
	)

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "default-secret-change-in-production"
		logger.Warn("Using default JWT secret - set JWT_SECRET environment variable", nil)
	}

	// Get base domain from environment or use default
	baseDomain := os.Getenv("BASE_DOMAIN")
	if baseDomain == "" {
		baseDomain = "photographergallery.com"
	}

	return &services{
		gallery: gallery.NewService(repos.gallery, repos.photo, storageService),
		photo:   photo.NewService(repos.photo, repos.gallery, repos.favorite, storageService),
		session: auth.NewSessionService(repos.session, jwtSecret, cfg.SessionTTLHours),
		auth:    cognitoAuth.NewService(cfg.CognitoUserPoolID, cfg.CognitoRegion),
		domain:  customdomain.NewService(repos.photographer, baseDomain),
	}
}

func buildRouter(svc *services, repos *repositories, cfg *appConfig.Config) *api.Router {
	// Get base domain
	baseDomain := os.Getenv("BASE_DOMAIN")
	if baseDomain == "" {
		baseDomain = "photographergallery.com"
	}

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(repos.photographer)
	galleryHandler := handlers.NewGalleryHandler(svc.gallery)
	photoHandler := handlers.NewPhotoHandler(svc.photo)
	clientHandler := handlers.NewClientHandler(svc.gallery, svc.photo, svc.session)
	domainHandler := handlers.NewDomainHandler(svc.domain)
	portalHandler := handlers.NewPortalHandler(svc.domain, svc.gallery, repos.photographer)

	// Initialize middleware
	authMiddleware := middleware.NewAuthMiddleware(svc.auth)
	sessionMiddleware := middleware.NewSessionMiddleware(svc.session)
	domainMiddleware := middleware.NewDomainMiddleware(svc.domain, baseDomain)

	router := api.NewRouter()

	// Health check
	router.GET("/health", func(req *api.Request) (*api.Response, error) {
		return api.OK(map[string]string{"status": "healthy"}), nil
	})

	// Photographer routes (authenticated)
	photographerRoutes := api.NewRouter()
	photographerRoutes.Use(authMiddlewareWrapper(authMiddleware))

	photographerRoutes.GET("/api/v1/auth/me", wrapHandler(authHandler.GetMe))
	photographerRoutes.POST("/api/v1/galleries", wrapHandler(galleryHandler.CreateGallery))
	photographerRoutes.GET("/api/v1/galleries", wrapHandler(galleryHandler.ListGalleries))
	photographerRoutes.GET("/api/v1/galleries/{id}", wrapHandler(galleryHandler.GetGallery))
	photographerRoutes.PUT("/api/v1/galleries/{id}", wrapHandler(galleryHandler.UpdateGallery))
	photographerRoutes.DELETE("/api/v1/galleries/{id}", wrapHandler(galleryHandler.DeleteGallery))
	photographerRoutes.POST("/api/v1/galleries/{id}/expire", wrapHandler(galleryHandler.SetExpiration))
	photographerRoutes.POST("/api/v1/galleries/{id}/photos/upload-url", wrapHandler(photoHandler.GetUploadURL))
	photographerRoutes.GET("/api/v1/galleries/{id}/photos", wrapHandler(photoHandler.ListPhotos))
	photographerRoutes.DELETE("/api/v1/galleries/{galleryId}/photos/{photoId}", wrapHandler(photoHandler.DeletePhoto))
	photographerRoutes.GET("/api/v1/galleries/{id}/favorites", wrapHandler(photoHandler.GetFavorites))

	// Domain management routes (authenticated)
	photographerRoutes.GET("/api/v1/domain", wrapHandler(domainHandler.GetDomainConfig))
	photographerRoutes.POST("/api/v1/domain/subdomain", wrapHandler(domainHandler.RequestSubdomain))
	photographerRoutes.POST("/api/v1/domain/custom", wrapHandler(domainHandler.RequestCustomDomain))
	photographerRoutes.POST("/api/v1/domain/verify", wrapHandler(domainHandler.VerifyDomain))
	photographerRoutes.DELETE("/api/v1/domain", wrapHandler(domainHandler.RemoveDomain))

	// Portal routes (accessed via custom domain, uses domain middleware)
	portalRoutes := api.NewRouter()
	portalRoutes.Use(domainMiddlewareWrapper(domainMiddleware))
	portalRoutes.GET("/api/v1/portal/info", wrapHandler(portalHandler.GetPortalInfo))
	portalRoutes.GET("/api/v1/portal/galleries", wrapHandler(portalHandler.ListPortalGalleries))

	// Client routes
	router.POST("/api/v1/client/verify", wrapHandler(clientHandler.VerifyPassword))

	clientRoutes := api.NewRouter()
	clientRoutes.Use(sessionMiddlewareWrapper(sessionMiddleware))

	clientRoutes.GET("/api/v1/client/galleries/{customUrl}", wrapHandler(clientHandler.GetGallery))
	clientRoutes.GET("/api/v1/client/galleries/{customUrl}/photos", wrapHandler(clientHandler.ListPhotos))
	clientRoutes.GET("/api/v1/client/photos/{photoId}/download-url", wrapHandler(clientHandler.GetDownloadURL))
	clientRoutes.POST("/api/v1/client/photos/{photoId}/favorite", wrapHandler(clientHandler.ToggleFavorite))
	clientRoutes.GET("/api/v1/client/session/favorites", wrapHandler(clientHandler.GetSessionFavorites))

	// Mount sub-routers via notFound handler (middleware only applies to matched routes)
	router.SetNotFound(func(req *api.Request) (*api.Response, error) {
		// Try portal routes for /api/v1/portal/ paths
		if strings.HasPrefix(req.Path, "/api/v1/portal/") {
			return portalRoutes.Route(req)
		}
		// Try photographer routes for /api/v1/ paths (excluding /api/v1/client/ and /api/v1/portal/)
		if strings.HasPrefix(req.Path, "/api/v1/") && !strings.HasPrefix(req.Path, "/api/v1/client/") && !strings.HasPrefix(req.Path, "/api/v1/portal/") {
			return photographerRoutes.Route(req)
		}
		// Try client routes for /api/v1/client/ paths
		if strings.HasPrefix(req.Path, "/api/v1/client/") {
			return clientRoutes.Route(req)
		}
		return api.NotFound("Not found"), nil
	})

	return router
}

func (app *App) handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	logger.Info("Received request", map[string]interface{}{
		"method": req.HTTPMethod,
		"path":   req.Path,
	})

	if req.HTTPMethod == "OPTIONS" {
		return middleware.HandlePreflight(app.config.AllowedOrigins), nil
	}

	response, err := app.router.HandleLambda(ctx, req)
	if err != nil {
		logger.Error("Request failed", map[string]interface{}{"error": err.Error()})
	}

	return middleware.AddCORSHeaders(response, app.config.AllowedOrigins), nil
}

// wrapHandler adapts http.HandlerFunc to api.Handler.
func wrapHandler(fn http.HandlerFunc) api.Handler {
	return func(req *api.Request) (*api.Response, error) {
		rw := &responseCapture{statusCode: http.StatusOK, headers: http.Header{}}

		// Build HTTP request from api.Request
		httpReq, err := http.NewRequestWithContext(req.Context, "GET", req.Path, strings.NewReader(req.Body))
		if err != nil {
			return api.InternalError("failed to create request"), nil
		}
		for k, v := range req.Headers {
			httpReq.Header.Set(k, v)
		}
		// Store path params in context
		ctx := httpReq.Context()
		for k, v := range req.PathParams {
			ctx = context.WithValue(ctx, k, v)
		}
		httpReq = httpReq.WithContext(ctx)

		fn(rw, httpReq)

		headers := make(map[string]string)
		for k, vals := range rw.headers {
			if len(vals) > 0 {
				headers[k] = vals[0]
			}
		}

		// Parse the JSON body back into an interface{} to avoid double-encoding
		// when HandleLambda calls json.Marshal on the response body
		var body interface{}
		if rw.body != "" {
			if err := json.Unmarshal([]byte(rw.body), &body); err != nil {
				// If parsing fails, use the raw string
				body = rw.body
			}
		}

		return &api.Response{
			StatusCode: rw.statusCode,
			Body:       body,
			Headers:    headers,
		}, nil
	}
}

func authMiddlewareWrapper(m *middleware.AuthMiddleware) api.Middleware {
	return func(next api.Handler) api.Handler {
		return func(req *api.Request) (*api.Response, error) {
			// Simulate auth verification
			ctx, err := m.VerifyPhotographerToken(req.Context, events.APIGatewayProxyRequest{
				Headers: req.Headers,
			})
			if err != nil {
				return api.Unauthorized(err.Error()), nil
			}
			req.Context = ctx
			return next(req)
		}
	}
}

func sessionMiddlewareWrapper(m *middleware.SessionMiddleware) api.Middleware {
	return func(next api.Handler) api.Handler {
		return func(req *api.Request) (*api.Response, error) {
			ctx, err := m.VerifyClientSession(req.Context, events.APIGatewayProxyRequest{
				Headers: req.Headers,
			})
			if err != nil {
				return api.Unauthorized(err.Error()), nil
			}
			req.Context = ctx
			return next(req)
		}
	}
}

func domainMiddlewareWrapper(m *middleware.DomainMiddleware) api.Middleware {
	return func(next api.Handler) api.Handler {
		return func(req *api.Request) (*api.Response, error) {
			ctx, err := m.ResolvePhotographer(req.Context, events.APIGatewayProxyRequest{
				Headers: req.Headers,
			})
			if err != nil {
				// Domain resolution errors are not fatal - continue without photographer context
				logger.Warn("Domain resolution failed", map[string]interface{}{"error": err.Error()})
			}
			req.Context = ctx
			return next(req)
		}
	}
}

// responseCapture captures handler output for http.ResponseWriter.
type responseCapture struct {
	statusCode int
	body       string
	headers    http.Header
}

func (r *responseCapture) Write(b []byte) (int, error) {
	r.body += string(b)
	return len(b), nil
}

func (r *responseCapture) WriteHeader(code int) { r.statusCode = code }
func (r *responseCapture) Header() http.Header   { return r.headers }
