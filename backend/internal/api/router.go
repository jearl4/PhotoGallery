// Package api provides HTTP routing and middleware infrastructure.
package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/aws/aws-lambda-go/events"
)

// Request represents a normalized HTTP request.
type Request struct {
	Method      string
	Path        string
	PathParams  map[string]string
	QueryParams map[string]string
	Headers     map[string]string
	Body        string
	Context     context.Context
}

// Response represents an HTTP response.
type Response struct {
	StatusCode int
	Body       interface{}
	Headers    map[string]string
}

// Handler is a function that handles a request and returns a response.
type Handler func(req *Request) (*Response, error)

// Middleware wraps a handler to add functionality.
type Middleware func(Handler) Handler

// Route represents a registered route.
type Route struct {
	Method  string
	Pattern string
	Handler Handler
}

// Router handles HTTP routing with middleware support.
type Router struct {
	routes      []Route
	middlewares []Middleware
	notFound    Handler
}

// NewRouter creates a new Router.
func NewRouter() *Router {
	return &Router{
		routes:      make([]Route, 0),
		middlewares: make([]Middleware, 0),
		notFound: func(req *Request) (*Response, error) {
			return &Response{
				StatusCode: http.StatusNotFound,
				Body:       map[string]string{"message": "Not found"},
			}, nil
		},
	}
}

// Use adds middleware to the router.
func (r *Router) Use(middleware ...Middleware) *Router {
	r.middlewares = append(r.middlewares, middleware...)
	return r
}

// Handle registers a handler for a route.
func (r *Router) Handle(method, pattern string, handler Handler) *Router {
	r.routes = append(r.routes, Route{
		Method:  method,
		Pattern: pattern,
		Handler: handler,
	})
	return r
}

// GET registers a GET handler.
func (r *Router) GET(pattern string, handler Handler) *Router {
	return r.Handle(http.MethodGet, pattern, handler)
}

// POST registers a POST handler.
func (r *Router) POST(pattern string, handler Handler) *Router {
	return r.Handle(http.MethodPost, pattern, handler)
}

// PUT registers a PUT handler.
func (r *Router) PUT(pattern string, handler Handler) *Router {
	return r.Handle(http.MethodPut, pattern, handler)
}

// DELETE registers a DELETE handler.
func (r *Router) DELETE(pattern string, handler Handler) *Router {
	return r.Handle(http.MethodDelete, pattern, handler)
}

// SetNotFound sets the handler for routes that are not found.
func (r *Router) SetNotFound(handler Handler) *Router {
	r.notFound = handler
	return r
}

// matchRoute checks if a path matches a pattern and extracts path parameters.
func (r *Router) matchRoute(pattern, path string) (bool, map[string]string) {
	patternParts := strings.Split(strings.Trim(pattern, "/"), "/")
	pathParts := strings.Split(strings.Trim(path, "/"), "/")

	if len(patternParts) != len(pathParts) {
		return false, nil
	}

	params := make(map[string]string)
	for i, part := range patternParts {
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			paramName := part[1 : len(part)-1]
			params[paramName] = pathParts[i]
		} else if part != pathParts[i] {
			return false, nil
		}
	}

	return true, params
}

// Route finds and executes the handler for a request.
func (r *Router) Route(req *Request) (*Response, error) {
	for _, route := range r.routes {
		if route.Method != req.Method {
			continue
		}

		if match, params := r.matchRoute(route.Pattern, req.Path); match {
			req.PathParams = params
			handler := r.applyMiddleware(route.Handler)
			return handler(req)
		}
	}

	return r.notFound(req)
}

// applyMiddleware wraps a handler with all registered middleware.
func (r *Router) applyMiddleware(handler Handler) Handler {
	for i := len(r.middlewares) - 1; i >= 0; i-- {
		handler = r.middlewares[i](handler)
	}
	return handler
}

// HandleLambda converts Lambda API Gateway events to requests and routes them.
func (r *Router) HandleLambda(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	req := &Request{
		Method:      event.HTTPMethod,
		Path:        event.Path,
		PathParams:  event.PathParameters,
		QueryParams: event.QueryStringParameters,
		Headers:     event.Headers,
		Body:        event.Body,
		Context:     ctx,
	}

	resp, err := r.Route(req)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       `{"message": "Internal server error"}`,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
		}, nil
	}

	body, err := json.Marshal(resp.Body)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       `{"message": "Failed to serialize response"}`,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
		}, nil
	}

	headers := map[string]string{
		"Content-Type": "application/json",
	}
	for k, v := range resp.Headers {
		headers[k] = v
	}

	return events.APIGatewayProxyResponse{
		StatusCode: resp.StatusCode,
		Body:       string(body),
		Headers:    headers,
	}, nil
}

// JSON creates a JSON response with the given status code and body.
func JSON(status int, body interface{}) *Response {
	return &Response{
		StatusCode: status,
		Body:       body,
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
	}
}

// Error creates an error response.
func Error(status int, message string) *Response {
	return JSON(status, map[string]string{"message": message})
}

// OK creates a 200 OK response.
func OK(body interface{}) *Response {
	return JSON(http.StatusOK, body)
}

// Created creates a 201 Created response.
func Created(body interface{}) *Response {
	return JSON(http.StatusCreated, body)
}

// NoContent creates a 204 No Content response.
func NoContent() *Response {
	return &Response{StatusCode: http.StatusNoContent}
}

// BadRequest creates a 400 Bad Request response.
func BadRequest(message string) *Response {
	return Error(http.StatusBadRequest, message)
}

// Unauthorized creates a 401 Unauthorized response.
func Unauthorized(message string) *Response {
	return Error(http.StatusUnauthorized, message)
}

// NotFound creates a 404 Not Found response.
func NotFound(message string) *Response {
	return Error(http.StatusNotFound, message)
}

// InternalError creates a 500 Internal Server Error response.
func InternalError(message string) *Response {
	return Error(http.StatusInternalServerError, message)
}
