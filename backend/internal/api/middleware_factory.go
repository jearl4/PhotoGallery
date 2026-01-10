// Package api provides HTTP routing and middleware infrastructure.
package api

import (
	"log"
	"net/http"
	"strings"
	"time"
)

// MiddlewareFactory creates configured middleware instances.
type MiddlewareFactory struct {
	allowedOrigins []string
	jwtValidator   JWTValidator
}

// JWTValidator defines the interface for JWT validation.
type JWTValidator interface {
	ValidateToken(token string) (map[string]interface{}, error)
}

// NewMiddlewareFactory creates a new MiddlewareFactory.
func NewMiddlewareFactory(allowedOrigins []string, jwtValidator JWTValidator) *MiddlewareFactory {
	return &MiddlewareFactory{
		allowedOrigins: allowedOrigins,
		jwtValidator:   jwtValidator,
	}
}

// CORS creates CORS middleware.
func (f *MiddlewareFactory) CORS() Middleware {
	return func(next Handler) Handler {
		return func(req *Request) (*Response, error) {
			origin := req.Headers["origin"]
			if origin == "" {
				origin = req.Headers["Origin"]
			}

			// Check if origin is allowed
			allowed := false
			for _, o := range f.allowedOrigins {
				if o == "*" || o == origin {
					allowed = true
					break
				}
			}

			// Handle preflight
			if req.Method == http.MethodOptions {
				headers := map[string]string{
					"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization",
					"Access-Control-Max-Age":       "86400",
				}
				if allowed {
					headers["Access-Control-Allow-Origin"] = origin
					headers["Access-Control-Allow-Credentials"] = "true"
				}
				return &Response{
					StatusCode: http.StatusNoContent,
					Headers:    headers,
				}, nil
			}

			// Process request and add CORS headers to response
			resp, err := next(req)
			if err != nil {
				return resp, err
			}

			if resp.Headers == nil {
				resp.Headers = make(map[string]string)
			}
			if allowed {
				resp.Headers["Access-Control-Allow-Origin"] = origin
				resp.Headers["Access-Control-Allow-Credentials"] = "true"
			}

			return resp, nil
		}
	}
}

// Auth creates authentication middleware.
func (f *MiddlewareFactory) Auth() Middleware {
	return func(next Handler) Handler {
		return func(req *Request) (*Response, error) {
			authHeader := req.Headers["authorization"]
			if authHeader == "" {
				authHeader = req.Headers["Authorization"]
			}

			if authHeader == "" {
				return Unauthorized("Authorization header required"), nil
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				return Unauthorized("Invalid authorization header format"), nil
			}

			token := parts[1]
			claims, err := f.jwtValidator.ValidateToken(token)
			if err != nil {
				return Unauthorized("Invalid or expired token"), nil
			}

			// Add claims to request context
			if req.PathParams == nil {
				req.PathParams = make(map[string]string)
			}
			if userID, ok := claims["sub"].(string); ok {
				req.PathParams["__userId"] = userID
			}
			if email, ok := claims["email"].(string); ok {
				req.PathParams["__email"] = email
			}

			return next(req)
		}
	}
}

// Logging creates logging middleware.
func (f *MiddlewareFactory) Logging() Middleware {
	return func(next Handler) Handler {
		return func(req *Request) (*Response, error) {
			start := time.Now()

			resp, err := next(req)

			duration := time.Since(start)
			status := 0
			if resp != nil {
				status = resp.StatusCode
			}

			log.Printf("[%s] %s %s - %d (%v)",
				req.Method,
				req.Path,
				getClientIP(req),
				status,
				duration,
			)

			return resp, err
		}
	}
}

// Recovery creates panic recovery middleware.
func (f *MiddlewareFactory) Recovery() Middleware {
	return func(next Handler) Handler {
		return func(req *Request) (resp *Response, err error) {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("[PANIC] %s %s: %v", req.Method, req.Path, r)
					resp = InternalError("Internal server error")
					err = nil
				}
			}()
			return next(req)
		}
	}
}

// RateLimit creates rate limiting middleware (basic implementation).
func (f *MiddlewareFactory) RateLimit(requestsPerMinute int) Middleware {
	// Note: In production, use a distributed rate limiter with Redis
	return func(next Handler) Handler {
		return func(req *Request) (*Response, error) {
			// For Lambda, rate limiting should be done at API Gateway level
			// This is a placeholder for local development
			return next(req)
		}
	}
}

// getClientIP extracts the client IP from request headers.
func getClientIP(req *Request) string {
	// Check X-Forwarded-For first (common for proxied requests)
	if xff := req.Headers["X-Forwarded-For"]; xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	if xff := req.Headers["x-forwarded-for"]; xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	return "unknown"
}

// Chain combines multiple middleware into one.
func Chain(middlewares ...Middleware) Middleware {
	return func(final Handler) Handler {
		for i := len(middlewares) - 1; i >= 0; i-- {
			final = middlewares[i](final)
		}
		return final
	}
}

// ConditionalMiddleware applies middleware only if a condition is true.
func ConditionalMiddleware(condition func(*Request) bool, middleware Middleware) Middleware {
	return func(next Handler) Handler {
		return func(req *Request) (*Response, error) {
			if condition(req) {
				return middleware(next)(req)
			}
			return next(req)
		}
	}
}

// PathPrefix creates a condition for path prefix matching.
func PathPrefix(prefix string) func(*Request) bool {
	return func(req *Request) bool {
		return strings.HasPrefix(req.Path, prefix)
	}
}

// ExcludePaths creates middleware that skips certain paths.
func ExcludePaths(middleware Middleware, paths ...string) Middleware {
	return func(next Handler) Handler {
		return func(req *Request) (*Response, error) {
			for _, p := range paths {
				if req.Path == p {
					return next(req)
				}
			}
			return middleware(next)(req)
		}
	}
}
