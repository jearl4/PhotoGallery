// Package events provides an event bus implementation using the Observer pattern.
package events

import (
	"context"
	"sync"
	"time"

	"photographer-gallery/backend/pkg/logger"
)

// EventType represents the type of event.
type EventType string

// Event types
const (
	PhotoUploaded   EventType = "photo.uploaded"
	PhotoProcessed  EventType = "photo.processed"
	PhotoDeleted    EventType = "photo.deleted"
	GalleryCreated  EventType = "gallery.created"
	GalleryUpdated  EventType = "gallery.updated"
	GalleryDeleted  EventType = "gallery.deleted"
	FavoriteToggled EventType = "favorite.toggled"

	// Analytics events
	PhotoDownloaded      EventType = "photo.downloaded"
	ClientSessionCreated EventType = "client.session.created"
)

// Event represents an event in the system.
type Event interface {
	Type() EventType
	Payload() interface{}
	Timestamp() time.Time
	CorrelationID() string
}

// BaseEvent provides a base implementation of Event.
type BaseEvent struct {
	eventType     EventType
	payload       interface{}
	timestamp     time.Time
	correlationID string
}

// NewEvent creates a new event.
func NewEvent(eventType EventType, payload interface{}, correlationID string) Event {
	return &BaseEvent{
		eventType:     eventType,
		payload:       payload,
		timestamp:     time.Now(),
		correlationID: correlationID,
	}
}

// Type returns the event type.
func (e *BaseEvent) Type() EventType { return e.eventType }

// Payload returns the event payload.
func (e *BaseEvent) Payload() interface{} { return e.payload }

// Timestamp returns when the event occurred.
func (e *BaseEvent) Timestamp() time.Time { return e.timestamp }

// CorrelationID returns the correlation ID for tracing.
func (e *BaseEvent) CorrelationID() string { return e.correlationID }

// Handler is a function that handles events.
type Handler func(ctx context.Context, event Event) error

// Subscription represents a subscription to events.
type Subscription struct {
	ID        string
	EventType EventType
	Handler   Handler
}

// EventBus defines the interface for an event bus.
type EventBus interface {
	Subscribe(eventType EventType, handler Handler) *Subscription
	Unsubscribe(subscription *Subscription)
	Publish(ctx context.Context, event Event) error
	PublishAsync(ctx context.Context, event Event)
}

// InMemoryEventBus is an in-memory implementation of EventBus.
type InMemoryEventBus struct {
	mu            sync.RWMutex
	subscriptions map[EventType][]*Subscription
	nextID        int
}

// NewEventBus creates a new in-memory event bus.
func NewEventBus() EventBus {
	return &InMemoryEventBus{
		subscriptions: make(map[EventType][]*Subscription),
	}
}

// Subscribe adds a handler for a specific event type.
func (bus *InMemoryEventBus) Subscribe(eventType EventType, handler Handler) *Subscription {
	bus.mu.Lock()
	defer bus.mu.Unlock()

	bus.nextID++
	subscription := &Subscription{
		ID:        string(rune(bus.nextID)),
		EventType: eventType,
		Handler:   handler,
	}

	bus.subscriptions[eventType] = append(bus.subscriptions[eventType], subscription)
	return subscription
}

// Unsubscribe removes a subscription.
func (bus *InMemoryEventBus) Unsubscribe(subscription *Subscription) {
	bus.mu.Lock()
	defer bus.mu.Unlock()

	subs := bus.subscriptions[subscription.EventType]
	for i, sub := range subs {
		if sub.ID == subscription.ID {
			bus.subscriptions[subscription.EventType] = append(subs[:i], subs[i+1:]...)
			return
		}
	}
}

// Publish sends an event to all subscribers synchronously.
func (bus *InMemoryEventBus) Publish(ctx context.Context, event Event) error {
	bus.mu.RLock()
	subs := bus.subscriptions[event.Type()]
	bus.mu.RUnlock()

	for _, sub := range subs {
		if err := sub.Handler(ctx, event); err != nil {
			logger.Error("Event handler failed", map[string]interface{}{
				"eventType":     event.Type(),
				"correlationID": event.CorrelationID(),
				"error":         err.Error(),
			})
			return err
		}
	}
	return nil
}

// PublishAsync sends an event to all subscribers asynchronously.
func (bus *InMemoryEventBus) PublishAsync(ctx context.Context, event Event) {
	bus.mu.RLock()
	subs := bus.subscriptions[event.Type()]
	bus.mu.RUnlock()

	for _, sub := range subs {
		go func(s *Subscription) {
			if err := s.Handler(ctx, event); err != nil {
				logger.Error("Async event handler failed", map[string]interface{}{
					"eventType":     event.Type(),
					"correlationID": event.CorrelationID(),
					"error":         err.Error(),
				})
			}
		}(sub)
	}
}

// PhotoUploadedPayload contains data for photo upload events.
type PhotoUploadedPayload struct {
	PhotoID   string
	GalleryID string
	FileName  string
	Size      int64
}

// PhotoProcessedPayload contains data for photo processed events.
type PhotoProcessedPayload struct {
	PhotoID   string
	GalleryID string
	Status    string
	Width     int
	Height    int
}

// GalleryCreatedPayload contains data for gallery created events.
type GalleryCreatedPayload struct {
	GalleryID      string
	PhotographerID string
	Name           string
}

// GalleryDeletedPayload contains data for gallery deleted events.
type GalleryDeletedPayload struct {
	GalleryID      string
	PhotographerID string
	PhotoCount     int
}

// FavoriteToggledPayload contains data for favorite toggle events.
type FavoriteToggledPayload struct {
	PhotoID   string
	GalleryID string
	ClientID  string
	Favorited bool
}

// PhotoDownloadedPayload contains data for photo download events.
type PhotoDownloadedPayload struct {
	PhotoID        string
	GalleryID      string
	PhotographerID string
}

// ClientSessionCreatedPayload contains data for new session events.
type ClientSessionCreatedPayload struct {
	SessionID      string
	GalleryID      string
	PhotographerID string
	DeviceType     string
	BrowserFamily  string
	OSFamily       string
}
