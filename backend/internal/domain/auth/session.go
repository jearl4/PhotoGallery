package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"photographer-gallery/backend/internal/repository"
	"photographer-gallery/backend/pkg/errors"
	"photographer-gallery/backend/pkg/logger"
	"photographer-gallery/backend/pkg/utils"
)

// SessionService handles client session operations
type SessionService struct {
	sessionRepo   repository.ClientSessionRepository
	jwtSecret     []byte
	sessionTTL    time.Duration
}

// NewSessionService creates a new session service
func NewSessionService(sessionRepo repository.ClientSessionRepository, jwtSecret string, sessionTTLHours int) *SessionService {
	return &SessionService{
		sessionRepo: sessionRepo,
		jwtSecret:   []byte(jwtSecret),
		sessionTTL:  time.Duration(sessionTTLHours) * time.Hour,
	}
}

// SessionClaims represents JWT claims for client sessions
type SessionClaims struct {
	jwt.RegisteredClaims
	GalleryID string `json:"galleryId"`
	SessionID string `json:"sessionId"`
}

// CreateSession creates a new client session
func (s *SessionService) CreateSession(ctx context.Context, galleryID, ipAddress, userAgent string) (string, error) {
	// Generate session ID
	sessionID := utils.GenerateID("session")

	// Calculate TTL
	now := time.Now()
	expiresAt := now.Add(s.sessionTTL)

	// Create session record
	session := &repository.ClientSession{
		SessionID:     sessionID,
		GalleryID:     galleryID,
		IPAddressHash: utils.HashIPAddress(ipAddress),
		UserAgent:     userAgent,
		FirstAccessAt: now,
		LastAccessAt:  now,
		AccessCount:   1,
		TTL:           expiresAt.Unix(),
	}

	if err := s.sessionRepo.Create(ctx, session); err != nil {
		logger.Error("Failed to create session", map[string]interface{}{"error": err.Error()})
		return "", errors.Wrap(err, 500, "Failed to create session")
	}

	// Generate JWT token
	token, err := s.generateToken(galleryID, sessionID, expiresAt)
	if err != nil {
		return "", errors.Wrap(err, 500, "Failed to generate session token")
	}

	logger.Info("Client session created", map[string]interface{}{
		"sessionId": sessionID,
		"galleryId": galleryID,
	})

	return token, nil
}

// VerifySession verifies a session token
func (s *SessionService) VerifySession(ctx context.Context, tokenString string) (*SessionClaims, error) {
	// Parse token
	token, err := jwt.ParseWithClaims(tokenString, &SessionClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.NewUnauthorized("Invalid signing method")
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		logger.Warn("Failed to parse session token", map[string]interface{}{"error": err.Error()})
		return nil, errors.NewUnauthorized("Invalid session token")
	}

	claims, ok := token.Claims.(*SessionClaims)
	if !ok || !token.Valid {
		return nil, errors.NewUnauthorized("Invalid session claims")
	}

	// Verify expiration
	if claims.ExpiresAt != nil && claims.ExpiresAt.Before(time.Now()) {
		return nil, errors.NewUnauthorized("Session expired")
	}

	// Verify session exists in database
	session, err := s.sessionRepo.GetByID(ctx, claims.GalleryID, claims.SessionID)
	if err != nil {
		return nil, errors.Wrap(err, 500, "Failed to verify session")
	}
	if session == nil {
		return nil, errors.NewUnauthorized("Session not found")
	}

	// Update last access time
	session.LastAccessAt = time.Now()
	session.AccessCount++
	if err := s.sessionRepo.Update(ctx, session); err != nil {
		logger.Error("Failed to update session", map[string]interface{}{"error": err.Error()})
		// Don't fail the request for this
	}

	return claims, nil
}

// generateToken generates a JWT token for a session
func (s *SessionService) generateToken(galleryID, sessionID string, expiresAt time.Time) (string, error) {
	claims := SessionClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "photographer-gallery",
		},
		GalleryID: galleryID,
		SessionID: sessionID,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// GenerateJWTSecret generates a random secret for JWT signing
func GenerateJWTSecret() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(bytes), nil
}
