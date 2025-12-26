package main

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/aws/aws-lambda-go/events"
)

func TestHealthCheck(t *testing.T) {
	// Note: This test requires AWS credentials and will attempt to connect to AWS
	// Skip if not in integration test mode
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	app, err := initializeApp()
	if err != nil {
		// If initialization fails, it's likely due to missing AWS resources
		// This is expected in local testing without deployed infrastructure
		t.Skipf("Skipping test - app initialization failed (expected without AWS resources): %v", err)
		return
	}

	req := events.APIGatewayProxyRequest{
		HTTPMethod: "GET",
		Path:       "/health",
		Headers:    map[string]string{},
	}

	resp, err := app.handler(context.Background(), req)
	if err != nil {
		t.Fatalf("handler error: %v", err)
	}

	if resp.StatusCode != 200 {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
		t.Logf("Response body: %s", resp.Body)
	}

	var body map[string]interface{}
	if err := json.Unmarshal([]byte(resp.Body), &body); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if body["status"] != "healthy" {
		t.Errorf("expected healthy status, got %v", body["status"])
	}

	t.Logf("✅ Health check passed!")
}

func TestCORSPreflight(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	app, err := initializeApp()
	if err != nil {
		t.Skipf("Skipping test - app initialization failed: %v", err)
		return
	}

	req := events.APIGatewayProxyRequest{
		HTTPMethod: "OPTIONS",
		Path:       "/api/v1/galleries",
		Headers:    map[string]string{},
	}

	resp, err := app.handler(context.Background(), req)
	if err != nil {
		t.Fatalf("handler error: %v", err)
	}

	if resp.StatusCode != 200 {
		t.Errorf("expected status 200 for OPTIONS, got %d", resp.StatusCode)
	}

	// Check CORS headers
	if resp.Headers["Access-Control-Allow-Origin"] == "" {
		t.Error("missing Access-Control-Allow-Origin header")
	}
	if resp.Headers["Access-Control-Allow-Methods"] == "" {
		t.Error("missing Access-Control-Allow-Methods header")
	}

	t.Logf("✅ CORS preflight passed!")
	t.Logf("CORS headers: %+v", resp.Headers)
}

func TestNotFoundRoute(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	app, err := initializeApp()
	if err != nil {
		t.Skipf("Skipping test - app initialization failed: %v", err)
		return
	}

	req := events.APIGatewayProxyRequest{
		HTTPMethod: "GET",
		Path:       "/api/v1/nonexistent",
		Headers:    map[string]string{},
	}

	resp, err := app.handler(context.Background(), req)
	if err != nil {
		t.Fatalf("handler error: %v", err)
	}

	if resp.StatusCode != 404 {
		t.Errorf("expected status 404 for unknown route, got %d", resp.StatusCode)
	}

	t.Logf("✅ Not found handling passed!")
}

func TestUnauthorizedRequest(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	app, err := initializeApp()
	if err != nil {
		t.Skipf("Skipping test - app initialization failed: %v", err)
		return
	}

	// Try to access photographer endpoint without auth
	req := events.APIGatewayProxyRequest{
		HTTPMethod: "GET",
		Path:       "/api/v1/galleries",
		Headers:    map[string]string{},
	}

	resp, err := app.handler(context.Background(), req)
	if err != nil {
		t.Fatalf("handler error: %v", err)
	}

	if resp.StatusCode != 401 {
		t.Errorf("expected status 401 for unauthorized request, got %d", resp.StatusCode)
		t.Logf("Response: %s", resp.Body)
	}

	t.Logf("✅ Authorization check passed!")
}
