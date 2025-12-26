package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"photographer-gallery/backend/pkg/errors"
	"photographer-gallery/backend/pkg/logger"
)

// Service handles authentication operations
type Service struct {
	userPoolID string
	region     string
	publicKeys map[string]*rsa.PublicKey
	jwksURL    string
}

// NewService creates a new auth service
func NewService(userPoolID, region string) *Service {
	jwksURL := fmt.Sprintf("https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json", region, userPoolID)
	return &Service{
		userPoolID: userPoolID,
		region:     region,
		publicKeys: make(map[string]*rsa.PublicKey),
		jwksURL:    jwksURL,
	}
}

// JWK represents a JSON Web Key
type JWK struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
}

// JWKS represents a set of JWKs
type JWKS struct {
	Keys []JWK `json:"keys"`
}

// Claims represents JWT claims
type Claims struct {
	jwt.RegisteredClaims
	CognitoUsername string `json:"cognito:username"`
	Email           string `json:"email"`
	TokenUse        string `json:"token_use"`
}

// VerifyToken verifies a Cognito JWT token
func (s *Service) VerifyToken(ctx context.Context, tokenString string) (*Claims, error) {
	// Parse token without verification first to get the kid
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		// Get kid from header
		kid, ok := token.Header["kid"].(string)
		if !ok {
			return nil, fmt.Errorf("kid not found in token header")
		}

		// Get or fetch public key
		publicKey, err := s.getPublicKey(ctx, kid)
		if err != nil {
			return nil, err
		}

		return publicKey, nil
	})

	if err != nil {
		logger.Warn("Failed to verify token", map[string]interface{}{"error": err.Error()})
		return nil, errors.NewUnauthorized("Invalid token")
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.NewUnauthorized("Invalid token claims")
	}

	// Verify token_use
	if claims.TokenUse != "access" && claims.TokenUse != "id" {
		return nil, errors.NewUnauthorized("Invalid token use")
	}

	// Verify issuer
	expectedIssuer := fmt.Sprintf("https://cognito-idp.%s.amazonaws.com/%s", s.region, s.userPoolID)
	if claims.Issuer != expectedIssuer {
		return nil, errors.NewUnauthorized("Invalid token issuer")
	}

	// Verify expiration
	if claims.ExpiresAt != nil && claims.ExpiresAt.Before(time.Now()) {
		return nil, errors.NewUnauthorized("Token expired")
	}

	return claims, nil
}

// getPublicKey fetches or retrieves cached public key
func (s *Service) getPublicKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	// Check cache
	if key, ok := s.publicKeys[kid]; ok {
		return key, nil
	}

	// Fetch JWKS
	if err := s.fetchJWKS(ctx); err != nil {
		return nil, err
	}

	// Check cache again
	if key, ok := s.publicKeys[kid]; ok {
		return key, nil
	}

	return nil, fmt.Errorf("public key not found for kid: %s", kid)
}

// fetchJWKS fetches and caches public keys from Cognito
func (s *Service) fetchJWKS(ctx context.Context) error {
	resp, err := http.Get(s.jwksURL)
	if err != nil {
		logger.Error("Failed to fetch JWKS", map[string]interface{}{"error": err.Error()})
		return fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	var jwks JWKS
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		logger.Error("Failed to decode JWKS", map[string]interface{}{"error": err.Error()})
		return fmt.Errorf("failed to decode JWKS: %w", err)
	}

	// Convert JWKs to RSA public keys
	for _, key := range jwks.Keys {
		if key.Kty != "RSA" {
			continue
		}

		n, err := base64.RawURLEncoding.DecodeString(key.N)
		if err != nil {
			logger.Error("Failed to decode N", map[string]interface{}{"error": err.Error()})
			continue
		}

		e, err := base64.RawURLEncoding.DecodeString(key.E)
		if err != nil {
			logger.Error("Failed to decode E", map[string]interface{}{"error": err.Error()})
			continue
		}

		// Convert e to int
		var eInt int
		for _, b := range e {
			eInt = eInt<<8 + int(b)
		}

		publicKey := &rsa.PublicKey{
			N: new(big.Int).SetBytes(n),
			E: eInt,
		}

		s.publicKeys[key.Kid] = publicKey
	}

	logger.Info("Fetched JWKS", map[string]interface{}{"keyCount": len(s.publicKeys)})
	return nil
}

// ExtractToken extracts token from Authorization header
func ExtractToken(authHeader string) (string, error) {
	if authHeader == "" {
		return "", errors.NewUnauthorized("Missing authorization header")
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return "", errors.NewUnauthorized("Invalid authorization header format")
	}

	return parts[1], nil
}
