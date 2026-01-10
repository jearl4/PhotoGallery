// Package adapters provides infrastructure adapters for external services.
package adapters

import (
	"bytes"
	"context"
	"io"
	"log"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Client defines the interface for S3 operations.
type S3Client interface {
	GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error)
	PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error)
}

// S3Adapter provides simplified S3 operations.
type S3Adapter struct {
	client S3Client
}

// NewS3Adapter creates a new S3 adapter.
func NewS3Adapter(client S3Client) *S3Adapter {
	return &S3Adapter{client: client}
}

// Download downloads an object from S3 and returns a reader.
func (a *S3Adapter) Download(ctx context.Context, bucket, key string) (io.ReadCloser, error) {
	log.Printf("[S3Adapter] Downloading from %s/%s", bucket, key)

	output, err := a.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}

	return output.Body, nil
}

// DownloadBytes downloads an object and returns the bytes.
func (a *S3Adapter) DownloadBytes(ctx context.Context, bucket, key string) ([]byte, error) {
	reader, err := a.Download(ctx, bucket, key)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	return io.ReadAll(reader)
}

// Upload uploads data to S3.
func (a *S3Adapter) Upload(ctx context.Context, bucket, key string, data []byte, contentType string) error {
	log.Printf("[S3Adapter] Uploading to %s/%s (%d bytes)", bucket, key, len(data))

	_, err := a.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})

	return err
}
