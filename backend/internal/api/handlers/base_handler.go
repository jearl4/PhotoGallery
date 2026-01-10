// Package handlers provides HTTP handlers using the Template Method pattern.
package handlers

import (
	"encoding/json"
	"net/http"

	"photographer-gallery/backend/pkg/errors"
	"photographer-gallery/backend/pkg/logger"
)

// RequestHandler defines the interface for handling HTTP requests.
type RequestHandler interface {
	// ValidateRequest validates the incoming request.
	ValidateRequest(r *http.Request) error
	// Execute performs the main business logic.
	Execute(r *http.Request) (interface{}, error)
	// FormatResponse formats the successful response.
	FormatResponse(result interface{}) (int, interface{})
}

// BaseHandler provides the template method for HTTP request handling.
type BaseHandler struct{}

// Handle implements the template method pattern for HTTP request processing.
// It defines the algorithm skeleton: validate -> execute -> format response.
func (h *BaseHandler) Handle(handler RequestHandler, w http.ResponseWriter, r *http.Request) {
	// Step 1: Validate the request
	if err := handler.ValidateRequest(r); err != nil {
		h.respondError(w, err)
		return
	}

	// Step 2: Execute the business logic
	result, err := handler.Execute(r)
	if err != nil {
		h.respondError(w, err)
		return
	}

	// Step 3: Format and send the response
	status, response := handler.FormatResponse(result)
	h.respondJSON(w, status, response)
}

// respondJSON sends a JSON response.
func (h *BaseHandler) respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

// respondError sends an error response.
func (h *BaseHandler) respondError(w http.ResponseWriter, err error) {
	if appErr, ok := err.(*errors.AppError); ok {
		h.respondJSON(w, appErr.Code, appErr)
	} else {
		logger.Error("Unexpected error", map[string]interface{}{"error": err.Error()})
		h.respondJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Internal server error",
		})
	}
}

// DefaultValidation provides a default no-op validation.
type DefaultValidation struct{}

// ValidateRequest performs no validation (override in concrete handlers).
func (v *DefaultValidation) ValidateRequest(r *http.Request) error {
	return nil
}

// DefaultFormatter provides default response formatting.
type DefaultFormatter struct{}

// FormatResponse returns the result with 200 OK status.
func (f *DefaultFormatter) FormatResponse(result interface{}) (int, interface{}) {
	return http.StatusOK, result
}

// CreateFormatter returns 201 Created status.
type CreateFormatter struct{}

// FormatResponse returns the result with 201 Created status.
func (f *CreateFormatter) FormatResponse(result interface{}) (int, interface{}) {
	return http.StatusCreated, result
}

// NoContentFormatter returns 204 No Content status.
type NoContentFormatter struct{}

// FormatResponse returns nil with 204 No Content status.
func (f *NoContentFormatter) FormatResponse(result interface{}) (int, interface{}) {
	return http.StatusNoContent, nil
}

// HandlerFunc adapts a simple function to the RequestHandler interface.
type HandlerFunc struct {
	DefaultValidation
	DefaultFormatter
	Fn func(r *http.Request) (interface{}, error)
}

// Execute calls the wrapped function.
func (h *HandlerFunc) Execute(r *http.Request) (interface{}, error) {
	return h.Fn(r)
}

// WrapHandler creates a standard http.HandlerFunc from a RequestHandler.
func WrapHandler(handler RequestHandler) http.HandlerFunc {
	base := &BaseHandler{}
	return func(w http.ResponseWriter, r *http.Request) {
		base.Handle(handler, w, r)
	}
}
