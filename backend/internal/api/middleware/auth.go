package middleware

import (
	"context"

	"github.com/aws/aws-lambda-go/events"
	"photographer-gallery/backend/internal/domain/auth"
	cognitoAuth "photographer-gallery/backend/internal/services/auth"
	"photographer-gallery/backend/pkg/errors"
	"photographer-gallery/backend/pkg/logger"
)

// AuthMiddleware verifies photographer JWT tokens
type AuthMiddleware struct {
	authService *cognitoAuth.Service
}

// NewAuthMiddleware creates a new auth middleware
func NewAuthMiddleware(authService *cognitoAuth.Service) *AuthMiddleware {
	return &AuthMiddleware{
		authService: authService,
	}
}

// VerifyPhotographerToken verifies the Cognito JWT token
func (m *AuthMiddleware) VerifyPhotographerToken(ctx context.Context, req events.APIGatewayProxyRequest) (context.Context, error) {
	// Get authorization header
	authHeader := req.Headers["Authorization"]
	if authHeader == "" {
		authHeader = req.Headers["authorization"]
	}

	if authHeader == "" {
		logger.Warn("Missing authorization header", nil)
		return ctx, errors.NewUnauthorized("Missing authorization header")
	}

	// Extract token
	token, err := cognitoAuth.ExtractToken(authHeader)
	if err != nil {
		return ctx, err
	}

	// Verify token
	claims, err := m.authService.VerifyToken(ctx, token)
	if err != nil {
		return ctx, err
	}

	// Add user info to context
	ctx = context.WithValue(ctx, "userID", claims.CognitoUsername)
	ctx = context.WithValue(ctx, "email", claims.Email)
	ctx = context.WithValue(ctx, "name", claims.Name)

	logger.Info("Photographer authenticated", map[string]interface{}{
		"userId": claims.CognitoUsername,
		"email":  claims.Email,
	})

	return ctx, nil
}

// SessionMiddleware verifies client session tokens
type SessionMiddleware struct {
	sessionService *auth.SessionService
}

// NewSessionMiddleware creates a new session middleware
func NewSessionMiddleware(sessionService *auth.SessionService) *SessionMiddleware {
	return &SessionMiddleware{
		sessionService: sessionService,
	}
}

// VerifyClientSession verifies the client session token
func (m *SessionMiddleware) VerifyClientSession(ctx context.Context, req events.APIGatewayProxyRequest) (context.Context, error) {
	// Get authorization header
	authHeader := req.Headers["Authorization"]
	if authHeader == "" {
		authHeader = req.Headers["authorization"]
	}

	if authHeader == "" {
		logger.Warn("Missing session token", nil)
		return ctx, errors.NewUnauthorized("Missing session token")
	}

	// Extract token (format: "Bearer <token>")
	token, err := cognitoAuth.ExtractToken(authHeader)
	if err != nil {
		return ctx, err
	}

	// Verify session
	claims, err := m.sessionService.VerifySession(ctx, token)
	if err != nil {
		return ctx, err
	}

	// Add session info to context
	ctx = context.WithValue(ctx, "galleryID", claims.GalleryID)
	ctx = context.WithValue(ctx, "sessionID", claims.SessionID)

	logger.Info("Client session verified", map[string]interface{}{
		"sessionId": claims.SessionID,
		"galleryId": claims.GalleryID,
	})

	return ctx, nil
}
