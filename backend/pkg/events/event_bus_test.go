package events

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestNewEvent(t *testing.T) {
	payload := &PhotoUploadedPayload{
		PhotoID:   "photo_123",
		GalleryID: "gal_456",
		FileName:  "test.jpg",
		Size:      1024,
	}

	event := NewEvent(PhotoUploaded, payload, "corr_789")

	if event.Type() != PhotoUploaded {
		t.Errorf("Type() = %v, want %v", event.Type(), PhotoUploaded)
	}
	if event.CorrelationID() != "corr_789" {
		t.Errorf("CorrelationID() = %v, want %v", event.CorrelationID(), "corr_789")
	}
	if event.Timestamp().IsZero() {
		t.Error("Timestamp() should not be zero")
	}

	p, ok := event.Payload().(*PhotoUploadedPayload)
	if !ok {
		t.Fatal("Payload type assertion failed")
	}
	if p.PhotoID != "photo_123" {
		t.Errorf("Payload.PhotoID = %v, want %v", p.PhotoID, "photo_123")
	}
}

func TestEventBusSubscribeAndPublish(t *testing.T) {
	bus := NewEventBus()
	ctx := context.Background()

	var received bool
	var receivedEvent Event

	sub := bus.Subscribe(PhotoUploaded, func(ctx context.Context, event Event) error {
		received = true
		receivedEvent = event
		return nil
	})

	if sub == nil {
		t.Fatal("Subscribe() returned nil subscription")
	}

	event := NewEvent(PhotoUploaded, &PhotoUploadedPayload{PhotoID: "p1"}, "c1")
	err := bus.Publish(ctx, event)
	if err != nil {
		t.Fatalf("Publish() error = %v", err)
	}

	if !received {
		t.Error("Handler was not called")
	}
	if receivedEvent.Type() != PhotoUploaded {
		t.Errorf("Received wrong event type: %v", receivedEvent.Type())
	}
}

func TestEventBusMultipleSubscribers(t *testing.T) {
	bus := NewEventBus()
	ctx := context.Background()

	var count int32

	bus.Subscribe(PhotoProcessed, func(ctx context.Context, event Event) error {
		atomic.AddInt32(&count, 1)
		return nil
	})
	bus.Subscribe(PhotoProcessed, func(ctx context.Context, event Event) error {
		atomic.AddInt32(&count, 1)
		return nil
	})
	bus.Subscribe(PhotoProcessed, func(ctx context.Context, event Event) error {
		atomic.AddInt32(&count, 1)
		return nil
	})

	event := NewEvent(PhotoProcessed, &PhotoProcessedPayload{PhotoID: "p1"}, "c1")
	bus.Publish(ctx, event)

	if count != 3 {
		t.Errorf("Expected 3 handlers to be called, got %d", count)
	}
}

func TestEventBusUnsubscribe(t *testing.T) {
	bus := NewEventBus()
	ctx := context.Background()

	var callCount int

	sub := bus.Subscribe(GalleryCreated, func(ctx context.Context, event Event) error {
		callCount++
		return nil
	})

	// First publish should call handler
	event := NewEvent(GalleryCreated, &GalleryCreatedPayload{GalleryID: "g1"}, "c1")
	bus.Publish(ctx, event)

	if callCount != 1 {
		t.Errorf("Expected 1 call, got %d", callCount)
	}

	// Unsubscribe
	bus.Unsubscribe(sub)

	// Second publish should not call handler
	bus.Publish(ctx, event)

	if callCount != 1 {
		t.Errorf("Expected still 1 call after unsubscribe, got %d", callCount)
	}
}

func TestEventBusHandlerError(t *testing.T) {
	bus := NewEventBus()
	ctx := context.Background()

	expectedErr := errors.New("handler error")

	bus.Subscribe(PhotoDeleted, func(ctx context.Context, event Event) error {
		return expectedErr
	})

	event := NewEvent(PhotoDeleted, nil, "c1")
	err := bus.Publish(ctx, event)

	if err != expectedErr {
		t.Errorf("Publish() error = %v, want %v", err, expectedErr)
	}
}

func TestEventBusPublishAsync(t *testing.T) {
	bus := NewEventBus()
	ctx := context.Background()

	var wg sync.WaitGroup
	wg.Add(2)

	var received1, received2 bool

	bus.Subscribe(FavoriteToggled, func(ctx context.Context, event Event) error {
		defer wg.Done()
		time.Sleep(10 * time.Millisecond)
		received1 = true
		return nil
	})
	bus.Subscribe(FavoriteToggled, func(ctx context.Context, event Event) error {
		defer wg.Done()
		time.Sleep(10 * time.Millisecond)
		received2 = true
		return nil
	})

	event := NewEvent(FavoriteToggled, &FavoriteToggledPayload{PhotoID: "p1"}, "c1")
	bus.PublishAsync(ctx, event)

	// Wait for async handlers
	wg.Wait()

	if !received1 || !received2 {
		t.Error("Async handlers were not called")
	}
}

func TestEventBusNoSubscribers(t *testing.T) {
	bus := NewEventBus()
	ctx := context.Background()

	// Publishing to an event with no subscribers should not error
	event := NewEvent(GalleryUpdated, nil, "c1")
	err := bus.Publish(ctx, event)

	if err != nil {
		t.Errorf("Publish() error = %v, want nil", err)
	}
}

func TestEventBusDifferentEventTypes(t *testing.T) {
	bus := NewEventBus()
	ctx := context.Background()

	var uploadCalled, deleteCalled bool

	bus.Subscribe(PhotoUploaded, func(ctx context.Context, event Event) error {
		uploadCalled = true
		return nil
	})
	bus.Subscribe(PhotoDeleted, func(ctx context.Context, event Event) error {
		deleteCalled = true
		return nil
	})

	// Only publish upload event
	event := NewEvent(PhotoUploaded, nil, "c1")
	bus.Publish(ctx, event)

	if !uploadCalled {
		t.Error("Upload handler should have been called")
	}
	if deleteCalled {
		t.Error("Delete handler should not have been called")
	}
}

func TestPayloadTypes(t *testing.T) {
	t.Run("PhotoUploadedPayload", func(t *testing.T) {
		p := PhotoUploadedPayload{
			PhotoID:   "photo_1",
			GalleryID: "gal_1",
			FileName:  "test.jpg",
			Size:      2048,
		}
		if p.PhotoID != "photo_1" || p.Size != 2048 {
			t.Error("PhotoUploadedPayload fields not set correctly")
		}
	})

	t.Run("PhotoProcessedPayload", func(t *testing.T) {
		p := PhotoProcessedPayload{
			PhotoID:   "photo_1",
			GalleryID: "gal_1",
			Status:    "completed",
			Width:     1920,
			Height:    1080,
		}
		if p.Status != "completed" || p.Width != 1920 {
			t.Error("PhotoProcessedPayload fields not set correctly")
		}
	})

	t.Run("GalleryCreatedPayload", func(t *testing.T) {
		p := GalleryCreatedPayload{
			GalleryID:      "gal_1",
			PhotographerID: "user_1",
			Name:           "Test Gallery",
		}
		if p.Name != "Test Gallery" {
			t.Error("GalleryCreatedPayload fields not set correctly")
		}
	})

	t.Run("GalleryDeletedPayload", func(t *testing.T) {
		p := GalleryDeletedPayload{
			GalleryID:      "gal_1",
			PhotographerID: "user_1",
			PhotoCount:     10,
		}
		if p.PhotoCount != 10 {
			t.Error("GalleryDeletedPayload fields not set correctly")
		}
	})

	t.Run("FavoriteToggledPayload", func(t *testing.T) {
		p := FavoriteToggledPayload{
			PhotoID:   "photo_1",
			ClientID:  "client_1",
			Favorited: true,
		}
		if !p.Favorited {
			t.Error("FavoriteToggledPayload fields not set correctly")
		}
	})
}
