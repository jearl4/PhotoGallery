package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"photographer-gallery/backend/pkg/errors"
)

type mockHandler struct {
	DefaultValidation
	DefaultFormatter
	result interface{}
	err    error
}

func (m *mockHandler) Execute(r *http.Request) (interface{}, error) {
	return m.result, m.err
}

type validatingHandler struct {
	DefaultFormatter
	validationErr error
	result        interface{}
}

func (h *validatingHandler) ValidateRequest(r *http.Request) error {
	return h.validationErr
}

func (h *validatingHandler) Execute(r *http.Request) (interface{}, error) {
	return h.result, nil
}

func TestBaseHandler_Handle_Success(t *testing.T) {
	handler := &mockHandler{result: map[string]string{"message": "success"}}
	base := &BaseHandler{}

	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()

	base.Handle(handler, rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Status = %d, want %d", rec.Code, http.StatusOK)
	}

	var response map[string]string
	json.NewDecoder(rec.Body).Decode(&response)
	if response["message"] != "success" {
		t.Errorf("Response message = %v, want success", response["message"])
	}
}

func TestBaseHandler_Handle_ValidationError(t *testing.T) {
	handler := &validatingHandler{
		validationErr: errors.NewBadRequest("invalid input"),
		result:        nil,
	}
	base := &BaseHandler{}

	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()

	base.Handle(handler, rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("Status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestBaseHandler_Handle_ExecuteError(t *testing.T) {
	handler := &mockHandler{
		result: nil,
		err:    errors.NewNotFound("resource not found"),
	}
	base := &BaseHandler{}

	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()

	base.Handle(handler, rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("Status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

type createHandler struct {
	DefaultValidation
	CreateFormatter
	result interface{}
}

func (h *createHandler) Execute(r *http.Request) (interface{}, error) {
	return h.result, nil
}

func TestCreateFormatter(t *testing.T) {
	handler := &createHandler{result: map[string]string{"id": "123"}}
	base := &BaseHandler{}

	req := httptest.NewRequest("POST", "/test", nil)
	rec := httptest.NewRecorder()

	base.Handle(handler, rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("Status = %d, want %d", rec.Code, http.StatusCreated)
	}
}

type deleteHandler struct {
	DefaultValidation
	NoContentFormatter
}

func (h *deleteHandler) Execute(r *http.Request) (interface{}, error) {
	return nil, nil
}

func TestNoContentFormatter(t *testing.T) {
	handler := &deleteHandler{}
	base := &BaseHandler{}

	req := httptest.NewRequest("DELETE", "/test", nil)
	rec := httptest.NewRecorder()

	base.Handle(handler, rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("Status = %d, want %d", rec.Code, http.StatusNoContent)
	}
}

func TestHandlerFunc(t *testing.T) {
	handler := &HandlerFunc{
		Fn: func(r *http.Request) (interface{}, error) {
			return map[string]string{"status": "ok"}, nil
		},
	}
	base := &BaseHandler{}

	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()

	base.Handle(handler, rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestWrapHandler(t *testing.T) {
	handler := &mockHandler{result: map[string]string{"wrapped": "true"}}
	wrapped := WrapHandler(handler)

	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()

	wrapped(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Status = %d, want %d", rec.Code, http.StatusOK)
	}
}
