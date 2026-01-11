package analytics

import "time"

// DashboardSummary represents the main dashboard metrics
type DashboardSummary struct {
	// Engagement metrics
	TotalViews     int64 `json:"totalViews"`
	TotalDownloads int64 `json:"totalDownloads"`
	TotalFavorites int64 `json:"totalFavorites"`

	// Storage metrics
	TotalPhotos       int   `json:"totalPhotos"`
	TotalGalleries    int   `json:"totalGalleries"`
	ActiveGalleries   int   `json:"activeGalleries"`
	TotalStorageBytes int64 `json:"totalStorageBytes"`

	// Client metrics
	TotalClients int64 `json:"totalClients"`
}

// GalleryAnalytics represents per-gallery analytics
type GalleryAnalytics struct {
	GalleryID          string     `json:"galleryId"`
	Name               string     `json:"name"`
	PhotoCount         int        `json:"photoCount"`
	TotalSize          int64      `json:"totalSize"`
	ViewCount          int64      `json:"viewCount"`
	DownloadCount      int64      `json:"downloadCount"`
	FavoriteCount      int64      `json:"favoriteCount"`
	UniqueClients      int64      `json:"uniqueClients"`
	ClientAccessCount  int        `json:"clientAccessCount"`
	LastClientAccessAt *time.Time `json:"lastClientAccessAt,omitempty"`
	CreatedAt          time.Time  `json:"createdAt"`
	Status             string     `json:"status"`
}

// TopPhoto represents a popular photo
type TopPhoto struct {
	PhotoID       string `json:"photoId"`
	GalleryID     string `json:"galleryId"`
	GalleryName   string `json:"galleryName"`
	FileName      string `json:"fileName"`
	ThumbnailKey  string `json:"thumbnailKey"`
	FavoriteCount int    `json:"favoriteCount"`
	DownloadCount int    `json:"downloadCount"`
}

// DeviceDistribution represents device type breakdown
type DeviceDistribution struct {
	Mobile  int64 `json:"mobile"`
	Tablet  int64 `json:"tablet"`
	Desktop int64 `json:"desktop"`
}

// BrowserDistribution represents browser breakdown
type BrowserDistribution struct {
	Browser    string  `json:"browser"`
	Count      int64   `json:"count"`
	Percentage float64 `json:"percentage"`
}

// ClientBehaviorAnalytics contains client device/browser analytics
type ClientBehaviorAnalytics struct {
	Devices  DeviceDistribution    `json:"devices"`
	Browsers []BrowserDistribution `json:"browsers"`
}

// GalleriesAnalyticsResponse is the response for galleries analytics endpoint
type GalleriesAnalyticsResponse struct {
	Galleries []*GalleryAnalytics `json:"galleries"`
}

// TopPhotosResponse is the response for top photos endpoint
type TopPhotosResponse struct {
	Photos []*TopPhoto `json:"photos"`
}
