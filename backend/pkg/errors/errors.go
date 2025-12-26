package errors

import (
	"fmt"
	"net/http"
)

// AppError represents an application error with HTTP status code
type AppError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Err     error  `json:"-"`
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

// New creates a new AppError
func New(code int, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
	}
}

// Wrap wraps an error with a message and status code
func Wrap(err error, code int, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Err:     err,
	}
}

// Common errors
var (
	ErrNotFound          = New(http.StatusNotFound, "Resource not found")
	ErrUnauthorized      = New(http.StatusUnauthorized, "Unauthorized")
	ErrForbidden         = New(http.StatusForbidden, "Forbidden")
	ErrBadRequest        = New(http.StatusBadRequest, "Bad request")
	ErrInternalServer    = New(http.StatusInternalServerError, "Internal server error")
	ErrConflict          = New(http.StatusConflict, "Resource already exists")
	ErrInvalidCredentials = New(http.StatusUnauthorized, "Invalid credentials")
)

// NewNotFound creates a not found error
func NewNotFound(resource string) *AppError {
	return New(http.StatusNotFound, fmt.Sprintf("%s not found", resource))
}

// NewBadRequest creates a bad request error
func NewBadRequest(message string) *AppError {
	return New(http.StatusBadRequest, message)
}

// NewUnauthorized creates an unauthorized error
func NewUnauthorized(message string) *AppError {
	return New(http.StatusUnauthorized, message)
}

// NewInternalServer creates an internal server error
func NewInternalServer(message string) *AppError {
	return New(http.StatusInternalServerError, message)
}
