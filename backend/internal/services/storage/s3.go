package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"photographer-gallery/backend/pkg/logger"
)

// Service handles S3 storage operations
type Service struct {
	client            *s3.Client
	originalBucket    string
	optimizedBucket   string
	thumbnailBucket   string
	presignClient     *s3.PresignClient
	presignExpiration time.Duration
}

// NewService creates a new S3 storage service
func NewService(
	client *s3.Client,
	originalBucket string,
	optimizedBucket string,
	thumbnailBucket string,
	presignExpiration time.Duration,
) *Service {
	return &Service{
		client:            client,
		originalBucket:    originalBucket,
		optimizedBucket:   optimizedBucket,
		thumbnailBucket:   thumbnailBucket,
		presignClient:     s3.NewPresignClient(client),
		presignExpiration: presignExpiration,
	}
}

// UploadURLRequest represents a request for an upload URL
type UploadURLRequest struct {
	GalleryID string
	PhotoID   string
	FileName  string
	MimeType  string
}

// UploadURLResponse contains the presigned upload URL
type UploadURLResponse struct {
	URL    string
	Key    string
	Fields map[string]string
}

// GenerateUploadURL creates a presigned URL for uploading photos
func (s *Service) GenerateUploadURL(ctx context.Context, req UploadURLRequest) (*UploadURLResponse, error) {
	key := fmt.Sprintf("%s/%s/%s", req.GalleryID, req.PhotoID, req.FileName)

	putObjectInput := &s3.PutObjectInput{
		Bucket:      aws.String(s.originalBucket),
		Key:         aws.String(key),
		ContentType: aws.String(req.MimeType),
	}

	presignedReq, err := s.presignClient.PresignPutObject(ctx, putObjectInput, func(opts *s3.PresignOptions) {
		opts.Expires = s.presignExpiration
	})

	if err != nil {
		logger.Error("Failed to generate presigned upload URL", map[string]interface{}{
			"error":     err.Error(),
			"galleryId": req.GalleryID,
			"photoId":   req.PhotoID,
		})
		return nil, fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	logger.Info("Generated upload URL", map[string]interface{}{
		"galleryId": req.GalleryID,
		"photoId":   req.PhotoID,
		"key":       key,
	})

	return &UploadURLResponse{
		URL:    presignedReq.URL,
		Key:    key,
		Fields: make(map[string]string),
	}, nil
}

// GenerateDownloadURL creates a presigned URL for downloading photos
func (s *Service) GenerateDownloadURL(ctx context.Context, key string, bucket string, filename string) (string, error) {
	if bucket == "" {
		bucket = s.optimizedBucket
	}

	getObjectInput := &s3.GetObjectInput{
		Bucket:                     aws.String(bucket),
		Key:                        aws.String(key),
		ResponseContentDisposition: aws.String(fmt.Sprintf("attachment; filename=\"%s\"", filename)),
	}

	presignedReq, err := s.presignClient.PresignGetObject(ctx, getObjectInput, func(opts *s3.PresignOptions) {
		opts.Expires = s.presignExpiration
	})

	if err != nil {
		logger.Error("Failed to generate presigned download URL", map[string]interface{}{
			"error":  err.Error(),
			"key":    key,
			"bucket": bucket,
		})
		return "", fmt.Errorf("failed to generate presigned download URL: %w", err)
	}

	logger.Info("Generated download URL", map[string]interface{}{
		"key":    key,
		"bucket": bucket,
	})

	return presignedReq.URL, nil
}

// DeleteObject deletes an object from S3
func (s *Service) DeleteObject(ctx context.Context, bucket, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})

	if err != nil {
		logger.Error("Failed to delete object", map[string]interface{}{
			"error":  err.Error(),
			"bucket": bucket,
			"key":    key,
		})
		return fmt.Errorf("failed to delete object: %w", err)
	}

	logger.Info("Deleted object", map[string]interface{}{
		"bucket": bucket,
		"key":    key,
	})

	return nil
}

// DeletePhoto deletes all versions of a photo (original, optimized, thumbnail)
func (s *Service) DeletePhoto(ctx context.Context, originalKey, optimizedKey, thumbnailKey string) error {
	// Delete original
	if err := s.DeleteObject(ctx, s.originalBucket, originalKey); err != nil {
		return err
	}

	// Delete optimized
	if err := s.DeleteObject(ctx, s.optimizedBucket, optimizedKey); err != nil {
		return err
	}

	// Delete thumbnail
	if err := s.DeleteObject(ctx, s.thumbnailBucket, thumbnailKey); err != nil {
		return err
	}

	return nil
}

// CopyObject copies an object within S3
func (s *Service) CopyObject(ctx context.Context, sourceBucket, sourceKey, destBucket, destKey string) error {
	copySource := fmt.Sprintf("%s/%s", sourceBucket, sourceKey)

	_, err := s.client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(destBucket),
		Key:        aws.String(destKey),
		CopySource: aws.String(copySource),
	})

	if err != nil {
		logger.Error("Failed to copy object", map[string]interface{}{
			"error":      err.Error(),
			"copySource": copySource,
			"destKey":    destKey,
		})
		return fmt.Errorf("failed to copy object: %w", err)
	}

	logger.Info("Copied object", map[string]interface{}{
		"copySource": copySource,
		"destKey":    destKey,
	})

	return nil
}

// GetObjectMetadata retrieves metadata for an object
func (s *Service) GetObjectMetadata(ctx context.Context, bucket, key string) (map[string]string, int64, error) {
	result, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})

	if err != nil {
		logger.Error("Failed to get object metadata", map[string]interface{}{
			"error":  err.Error(),
			"bucket": bucket,
			"key":    key,
		})
		return nil, 0, fmt.Errorf("failed to get object metadata: %w", err)
	}

	metadata := make(map[string]string)
	for k, v := range result.Metadata {
		metadata[k] = v
	}

	var size int64
	if result.ContentLength != nil {
		size = *result.ContentLength
	}

	return metadata, size, nil
}
