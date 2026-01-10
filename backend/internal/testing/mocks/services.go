// Package mocks provides mock implementations for external services.
package mocks

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"sync"
)

// MockStorageService is a mock implementation for S3 storage operations.
type MockStorageService struct {
	mu             sync.RWMutex
	objects        map[string][]byte
	deletedObjects []string
	DeletePhotoErr error
	UploadErr      error
	DownloadErr    error
	GenerateURLErr error
}

// NewMockStorageService creates a new mock storage service.
func NewMockStorageService() *MockStorageService {
	return &MockStorageService{
		objects:        make(map[string][]byte),
		deletedObjects: make([]string, 0),
	}
}

// DeletePhoto mocks deleting a photo from S3.
func (m *MockStorageService) DeletePhoto(ctx context.Context, originalKey, optimizedKey, thumbnailKey string) error {
	if m.DeletePhotoErr != nil {
		return m.DeletePhotoErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deletedObjects = append(m.deletedObjects, originalKey, optimizedKey, thumbnailKey)
	delete(m.objects, originalKey)
	delete(m.objects, optimizedKey)
	delete(m.objects, thumbnailKey)
	return nil
}

// Upload mocks uploading an object to S3.
func (m *MockStorageService) Upload(ctx context.Context, bucket, key string, body io.Reader, contentType string) error {
	if m.UploadErr != nil {
		return m.UploadErr
	}
	data, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.objects[bucket+"/"+key] = data
	return nil
}

// Download mocks downloading an object from S3.
func (m *MockStorageService) Download(ctx context.Context, bucket, key string) (io.ReadCloser, error) {
	if m.DownloadErr != nil {
		return nil, m.DownloadErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	data, ok := m.objects[bucket+"/"+key]
	if !ok {
		return nil, fmt.Errorf("object not found: %s/%s", bucket, key)
	}
	return io.NopCloser(bytes.NewReader(data)), nil
}

// GeneratePresignedURL mocks generating a presigned URL.
func (m *MockStorageService) GeneratePresignedURL(ctx context.Context, bucket, key string, expiry int64) (string, error) {
	if m.GenerateURLErr != nil {
		return "", m.GenerateURLErr
	}
	return fmt.Sprintf("https://%s.s3.amazonaws.com/%s?signature=mock", bucket, key), nil
}

// GetDeletedObjects returns the list of deleted object keys.
func (m *MockStorageService) GetDeletedObjects() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]string, len(m.deletedObjects))
	copy(result, m.deletedObjects)
	return result
}

// PutObject adds an object directly for test setup.
func (m *MockStorageService) PutObject(bucket, key string, data []byte) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.objects[bucket+"/"+key] = data
}

// ResetDeleted clears the deleted objects list.
func (m *MockStorageService) ResetDeleted() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deletedObjects = make([]string, 0)
}

// MockSQSClient is a mock implementation for SQS operations.
type MockSQSClient struct {
	mu           sync.RWMutex
	messages     []MockSQSMessage
	SendErr      error
	ReceiveErr   error
	DeleteErr    error
	receivedMsgs []string
}

// MockSQSMessage represents a mock SQS message.
type MockSQSMessage struct {
	MessageID     string
	Body          string
	ReceiptHandle string
}

// NewMockSQSClient creates a new mock SQS client.
func NewMockSQSClient() *MockSQSClient {
	return &MockSQSClient{
		messages:     make([]MockSQSMessage, 0),
		receivedMsgs: make([]string, 0),
	}
}

// SendMessage mocks sending a message to SQS.
func (m *MockSQSClient) SendMessage(ctx context.Context, queueURL, body string) (string, error) {
	if m.SendErr != nil {
		return "", m.SendErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	msgID := fmt.Sprintf("msg_%d", len(m.messages)+1)
	m.messages = append(m.messages, MockSQSMessage{
		MessageID:     msgID,
		Body:          body,
		ReceiptHandle: fmt.Sprintf("receipt_%d", len(m.messages)+1),
	})
	return msgID, nil
}

// ReceiveMessages mocks receiving messages from SQS.
func (m *MockSQSClient) ReceiveMessages(ctx context.Context, queueURL string, maxMessages int) ([]MockSQSMessage, error) {
	if m.ReceiveErr != nil {
		return nil, m.ReceiveErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	count := maxMessages
	if count > len(m.messages) {
		count = len(m.messages)
	}
	result := m.messages[:count]
	return result, nil
}

// DeleteMessage mocks deleting a message from SQS.
func (m *MockSQSClient) DeleteMessage(ctx context.Context, queueURL, receiptHandle string) error {
	if m.DeleteErr != nil {
		return m.DeleteErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	for i, msg := range m.messages {
		if msg.ReceiptHandle == receiptHandle {
			m.messages = append(m.messages[:i], m.messages[i+1:]...)
			m.receivedMsgs = append(m.receivedMsgs, msg.Body)
			break
		}
	}
	return nil
}

// AddMessage adds a message directly for test setup.
func (m *MockSQSClient) AddMessage(body string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	msgID := fmt.Sprintf("msg_%d", len(m.messages)+1)
	m.messages = append(m.messages, MockSQSMessage{
		MessageID:     msgID,
		Body:          body,
		ReceiptHandle: fmt.Sprintf("receipt_%d", len(m.messages)+1),
	})
}

// GetQueueLength returns the number of messages in the queue.
func (m *MockSQSClient) GetQueueLength() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.messages)
}

// GetProcessedMessages returns bodies of processed messages.
func (m *MockSQSClient) GetProcessedMessages() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]string, len(m.receivedMsgs))
	copy(result, m.receivedMsgs)
	return result
}

// MockImageProcessor is a mock implementation for image processing.
type MockImageProcessor struct {
	ProcessErr   error
	processCount int
	mu           sync.Mutex
}

// NewMockImageProcessor creates a new mock image processor.
func NewMockImageProcessor() *MockImageProcessor {
	return &MockImageProcessor{}
}

// Process mocks processing an image.
func (m *MockImageProcessor) Process(ctx context.Context, originalKey, galleryID, photoID string) error {
	if m.ProcessErr != nil {
		return m.ProcessErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.processCount++
	return nil
}

// GetProcessCount returns the number of images processed.
func (m *MockImageProcessor) GetProcessCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.processCount
}

// ResetProcessCount resets the process counter.
func (m *MockImageProcessor) ResetProcessCount() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.processCount = 0
}
