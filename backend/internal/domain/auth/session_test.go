package auth

import (
	"context"
	"testing"
	"time"

	"photographer-gallery/backend/internal/repository"
)

// Mock session repository
type mockSessionRepo struct {
	sessions  map[string]*repository.ClientSession
	createErr error
	getErr    error
	updateErr error
}

func newMockSessionRepo() *mockSessionRepo {
	return &mockSessionRepo{
		sessions: make(map[string]*repository.ClientSession),
	}
}

func (m *mockSessionRepo) Create(ctx context.Context, session *repository.ClientSession) error {
	if m.createErr != nil {
		return m.createErr
	}
	key := session.GalleryID + "#" + session.SessionID
	m.sessions[key] = session
	return nil
}

func (m *mockSessionRepo) GetByID(ctx context.Context, galleryID, sessionID string) (*repository.ClientSession, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	key := galleryID + "#" + sessionID
	return m.sessions[key], nil
}

func (m *mockSessionRepo) Update(ctx context.Context, session *repository.ClientSession) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	key := session.GalleryID + "#" + session.SessionID
	if m.sessions[key] != nil {
		m.sessions[key] = session
	}
	return nil
}

func (m *mockSessionRepo) Delete(ctx context.Context, galleryID, sessionID string) error {
	key := galleryID + "#" + sessionID
	delete(m.sessions, key)
	return nil
}

// Tests
func TestCreateSession(t *testing.T) {
	sessionRepo := newMockSessionRepo()
	jwtSecret := "test-secret-key"
	sessionTTLHours := 24

	service := NewSessionService(sessionRepo, jwtSecret, sessionTTLHours)

	galleryID := "gal_123"
	ipAddress := "192.168.1.1"
	userAgent := "Mozilla/5.0"

	token, err := service.CreateSession(context.Background(), galleryID, ipAddress, userAgent)
	if err != nil {
		t.Fatalf("CreateSession() error: %v", err)
	}

	if token == "" {
		t.Error("Token should not be empty")
	}

	// Verify session was created in repository
	if len(sessionRepo.sessions) != 1 {
		t.Errorf("Expected 1 session in repo, got %d", len(sessionRepo.sessions))
	}

	// Find the created session
	var session *repository.ClientSession
	for _, s := range sessionRepo.sessions {
		session = s
		break
	}

	if session == nil {
		t.Fatal("Session not found in repository")
	}

	if session.GalleryID != galleryID {
		t.Errorf("GalleryID = %v, want %v", session.GalleryID, galleryID)
	}

	if session.UserAgent != userAgent {
		t.Errorf("UserAgent = %v, want %v", session.UserAgent, userAgent)
	}

	if session.AccessCount != 1 {
		t.Errorf("AccessCount = %d, want 1", session.AccessCount)
	}

	// Verify IP was hashed (not stored in plain text)
	if session.IPAddressHash == ipAddress {
		t.Error("IP address should be hashed")
	}
}

func TestVerifySession(t *testing.T) {
	sessionRepo := newMockSessionRepo()
	jwtSecret := "test-secret-key"
	sessionTTLHours := 24

	service := NewSessionService(sessionRepo, jwtSecret, sessionTTLHours)

	galleryID := "gal_123"
	ipAddress := "192.168.1.1"
	userAgent := "Mozilla/5.0"

	// Create a session
	token, err := service.CreateSession(context.Background(), galleryID, ipAddress, userAgent)
	if err != nil {
		t.Fatalf("CreateSession() error: %v", err)
	}

	// Verify the session
	claims, err := service.VerifySession(context.Background(), token)
	if err != nil {
		t.Fatalf("VerifySession() error: %v", err)
	}

	if claims.GalleryID != galleryID {
		t.Errorf("GalleryID = %v, want %v", claims.GalleryID, galleryID)
	}

	if claims.SessionID == "" {
		t.Error("SessionID should not be empty")
	}

	// Verify access count was incremented
	session, _ := sessionRepo.GetByID(context.Background(), galleryID, claims.SessionID)
	if session.AccessCount != 2 { // 1 from create, 1 from verify
		t.Errorf("AccessCount = %d, want 2", session.AccessCount)
	}
}

func TestVerifySessionInvalidToken(t *testing.T) {
	sessionRepo := newMockSessionRepo()
	jwtSecret := "test-secret-key"
	sessionTTLHours := 24

	service := NewSessionService(sessionRepo, jwtSecret, sessionTTLHours)

	tests := []struct {
		name  string
		token string
	}{
		{"empty token", ""},
		{"invalid token", "invalid.jwt.token"},
		{"malformed token", "not-a-jwt"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.VerifySession(context.Background(), tt.token)
			if err == nil {
				t.Error("VerifySession() should fail with invalid token")
			}
		})
	}
}

func TestVerifySessionExpired(t *testing.T) {
	sessionRepo := newMockSessionRepo()
	jwtSecret := "test-secret-key"
	sessionTTLHours := 24

	service := NewSessionService(sessionRepo, jwtSecret, sessionTTLHours)

	galleryID := "gal_123"
	sessionID := "session_456"

	// Create an expired token manually
	expiresAt := time.Now().Add(-1 * time.Hour)
	expiredToken, err := service.generateToken(galleryID, sessionID, expiresAt)
	if err != nil {
		t.Fatalf("generateToken() error: %v", err)
	}

	// Create session in repo
	session := &repository.ClientSession{
		SessionID:     sessionID,
		GalleryID:     galleryID,
		IPAddressHash: "hashed-ip",
		UserAgent:     "test-agent",
		FirstAccessAt: time.Now().Add(-2 * time.Hour),
		LastAccessAt:  time.Now().Add(-1 * time.Hour),
		AccessCount:   1,
		TTL:           expiresAt.Unix(),
	}
	sessionRepo.sessions[galleryID+"#"+sessionID] = session

	// Try to verify expired token
	_, err = service.VerifySession(context.Background(), expiredToken)
	if err == nil {
		t.Error("VerifySession() should fail with expired token")
	}
}

func TestVerifySessionNotFound(t *testing.T) {
	sessionRepo := newMockSessionRepo()
	jwtSecret := "test-secret-key"
	sessionTTLHours := 24

	service := NewSessionService(sessionRepo, jwtSecret, sessionTTLHours)

	galleryID := "gal_123"
	sessionID := "session_456"

	// Create a valid token but don't create session in repo
	expiresAt := time.Now().Add(24 * time.Hour)
	token, err := service.generateToken(galleryID, sessionID, expiresAt)
	if err != nil {
		t.Fatalf("generateToken() error: %v", err)
	}

	// Try to verify token for non-existent session
	_, err = service.VerifySession(context.Background(), token)
	if err == nil {
		t.Error("VerifySession() should fail when session not found in database")
	}
}

func TestVerifySessionWrongSecret(t *testing.T) {
	sessionRepo1 := newMockSessionRepo()
	jwtSecret1 := "secret-key-1"
	service1 := NewSessionService(sessionRepo1, jwtSecret1, 24)

	sessionRepo2 := newMockSessionRepo()
	jwtSecret2 := "secret-key-2"
	service2 := NewSessionService(sessionRepo2, jwtSecret2, 24)

	// Create session with service1
	token, err := service1.CreateSession(context.Background(), "gal_123", "192.168.1.1", "test")
	if err != nil {
		t.Fatalf("CreateSession() error: %v", err)
	}

	// Try to verify with service2 (different secret)
	_, err = service2.VerifySession(context.Background(), token)
	if err == nil {
		t.Error("VerifySession() should fail when using wrong secret")
	}
}

func TestSessionTTL(t *testing.T) {
	sessionRepo := newMockSessionRepo()
	jwtSecret := "test-secret-key"
	sessionTTLHours := 48 // 2 days

	service := NewSessionService(sessionRepo, jwtSecret, sessionTTLHours)

	galleryID := "gal_123"
	ipAddress := "192.168.1.1"
	userAgent := "Mozilla/5.0"

	beforeCreate := time.Now()
	_, err := service.CreateSession(context.Background(), galleryID, ipAddress, userAgent)
	if err != nil {
		t.Fatalf("CreateSession() error: %v", err)
	}
	afterCreate := time.Now()

	// Find the created session
	var session *repository.ClientSession
	for _, s := range sessionRepo.sessions {
		session = s
		break
	}

	if session == nil {
		t.Fatal("Session not found in repository")
	}

	expectedTTL := beforeCreate.Add(48 * time.Hour).Unix()
	actualTTL := session.TTL

	// Allow 1 second tolerance for test execution time
	if actualTTL < expectedTTL || actualTTL > afterCreate.Add(48*time.Hour).Unix() {
		t.Errorf("TTL = %d, expected around %d", actualTTL, expectedTTL)
	}
}

func TestGenerateJWTSecret(t *testing.T) {
	secret1, err := GenerateJWTSecret()
	if err != nil {
		t.Fatalf("GenerateJWTSecret() error: %v", err)
	}

	if secret1 == "" {
		t.Error("Secret should not be empty")
	}

	// Generate another secret
	secret2, err := GenerateJWTSecret()
	if err != nil {
		t.Fatalf("GenerateJWTSecret() error: %v", err)
	}

	// Verify secrets are different (randomness)
	if secret1 == secret2 {
		t.Error("GenerateJWTSecret() should generate different secrets")
	}

	// Verify secret is base64 encoded
	if len(secret1) < 32 {
		t.Error("Secret should be at least 32 characters")
	}
}

func TestSessionAccessTracking(t *testing.T) {
	sessionRepo := newMockSessionRepo()
	jwtSecret := "test-secret-key"
	service := NewSessionService(sessionRepo, jwtSecret, 24)

	// Create session
	token, err := service.CreateSession(context.Background(), "gal_123", "192.168.1.1", "test")
	if err != nil {
		t.Fatalf("CreateSession() error: %v", err)
	}

	// Verify session multiple times
	for i := 0; i < 5; i++ {
		_, err := service.VerifySession(context.Background(), token)
		if err != nil {
			t.Fatalf("VerifySession() error: %v", err)
		}
	}

	// Get session and check access count
	var session *repository.ClientSession
	for _, s := range sessionRepo.sessions {
		session = s
		break
	}

	// Should be 6: 1 from create + 5 from verifies
	if session.AccessCount != 6 {
		t.Errorf("AccessCount = %d, want 6", session.AccessCount)
	}

	// Verify last access time was updated
	if session.LastAccessAt.Before(session.FirstAccessAt) {
		t.Error("LastAccessAt should be after FirstAccessAt")
	}
}
