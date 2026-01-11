package analytics

import (
	"context"
	"sort"

	"photographer-gallery/backend/internal/domain/photographer"
	"photographer-gallery/backend/internal/repository"
)

// Service handles analytics business logic
type Service struct {
	photographerRepo *PhotographerRepoAdapter
	galleryRepo      repository.GalleryRepository
	photoRepo        repository.PhotoRepository
	sessionRepo      repository.ClientSessionRepository
}

// PhotographerRepoAdapter wraps the photographer repository with analytics methods
type PhotographerRepoAdapter struct {
	GetByID func(ctx context.Context, userID string) (*photographer.Photographer, error)
}

// NewService creates a new analytics service
func NewService(
	photographerRepo *PhotographerRepoAdapter,
	galleryRepo repository.GalleryRepository,
	photoRepo repository.PhotoRepository,
	sessionRepo repository.ClientSessionRepository,
) *Service {
	return &Service{
		photographerRepo: photographerRepo,
		galleryRepo:      galleryRepo,
		photoRepo:        photoRepo,
		sessionRepo:      sessionRepo,
	}
}

// GetDashboardSummary returns aggregate metrics for the photographer
func (s *Service) GetDashboardSummary(ctx context.Context, photographerID string) (*DashboardSummary, error) {
	p, err := s.photographerRepo.GetByID(ctx, photographerID)
	if err != nil {
		return nil, err
	}

	return &DashboardSummary{
		TotalViews:        p.TotalViews,
		TotalDownloads:    p.TotalDownloads,
		TotalFavorites:    p.TotalFavorites,
		TotalPhotos:       p.TotalPhotos,
		TotalGalleries:    p.TotalGalleries,
		ActiveGalleries:   p.ActiveGalleries,
		TotalStorageBytes: p.StorageUsed,
		TotalClients:      p.TotalClients,
	}, nil
}

// GetGalleriesAnalytics returns analytics for all galleries
func (s *Service) GetGalleriesAnalytics(ctx context.Context, photographerID string, limit int, sortBy string) ([]*GalleryAnalytics, error) {
	galleries, _, err := s.galleryRepo.ListByPhotographer(ctx, photographerID, 100, nil)
	if err != nil {
		return nil, err
	}

	analytics := make([]*GalleryAnalytics, 0, len(galleries))
	for _, g := range galleries {
		analytics = append(analytics, &GalleryAnalytics{
			GalleryID:          g.GalleryID,
			Name:               g.Name,
			PhotoCount:         g.PhotoCount,
			TotalSize:          g.TotalSize,
			ViewCount:          g.ViewCount,
			DownloadCount:      g.TotalDownloads,
			FavoriteCount:      g.TotalFavorites,
			UniqueClients:      g.UniqueClients,
			ClientAccessCount:  g.ClientAccessCount,
			LastClientAccessAt: g.LastClientAccessAt,
			CreatedAt:          g.CreatedAt,
			Status:             g.Status,
		})
	}

	// Sort based on sortBy parameter
	switch sortBy {
	case "downloads":
		sort.Slice(analytics, func(i, j int) bool {
			return analytics[i].DownloadCount > analytics[j].DownloadCount
		})
	case "favorites":
		sort.Slice(analytics, func(i, j int) bool {
			return analytics[i].FavoriteCount > analytics[j].FavoriteCount
		})
	case "clients":
		sort.Slice(analytics, func(i, j int) bool {
			return analytics[i].UniqueClients > analytics[j].UniqueClients
		})
	default: // "views" or empty
		sort.Slice(analytics, func(i, j int) bool {
			return analytics[i].ViewCount > analytics[j].ViewCount
		})
	}

	// Apply limit
	if limit > 0 && len(analytics) > limit {
		analytics = analytics[:limit]
	}

	return analytics, nil
}

// GetTopPhotos returns the most popular photos by favorites or downloads
func (s *Service) GetTopPhotos(ctx context.Context, photographerID string, limit int, metric string) ([]*TopPhoto, error) {
	// Get all galleries for this photographer
	galleries, _, err := s.galleryRepo.ListByPhotographer(ctx, photographerID, 100, nil)
	if err != nil {
		return nil, err
	}

	// Build gallery name map
	galleryNames := make(map[string]string)
	for _, g := range galleries {
		galleryNames[g.GalleryID] = g.Name
	}

	// Collect all photos from all galleries
	var allPhotos []*repository.Photo
	for _, g := range galleries {
		photos, _, err := s.photoRepo.ListByGallery(ctx, g.GalleryID, 100, nil)
		if err != nil {
			continue // Skip galleries with errors
		}
		allPhotos = append(allPhotos, photos...)
	}

	// Sort photos by metric
	if metric == "downloads" {
		sort.Slice(allPhotos, func(i, j int) bool {
			return allPhotos[i].DownloadCount > allPhotos[j].DownloadCount
		})
	} else { // "favorites" or default
		sort.Slice(allPhotos, func(i, j int) bool {
			return allPhotos[i].FavoriteCount > allPhotos[j].FavoriteCount
		})
	}

	// Apply limit and convert to TopPhoto
	if limit > 0 && len(allPhotos) > limit {
		allPhotos = allPhotos[:limit]
	}

	topPhotos := make([]*TopPhoto, 0, len(allPhotos))
	for _, p := range allPhotos {
		topPhotos = append(topPhotos, &TopPhoto{
			PhotoID:       p.PhotoID,
			GalleryID:     p.GalleryID,
			GalleryName:   galleryNames[p.GalleryID],
			FileName:      p.FileName,
			ThumbnailKey:  p.ThumbnailKey,
			FavoriteCount: p.FavoriteCount,
			DownloadCount: p.DownloadCount,
		})
	}

	return topPhotos, nil
}

// GetClientBehavior returns device/browser distribution
func (s *Service) GetClientBehavior(ctx context.Context, photographerID string) (*ClientBehaviorAnalytics, error) {
	// Get all galleries for this photographer
	galleries, _, err := s.galleryRepo.ListByPhotographer(ctx, photographerID, 100, nil)
	if err != nil {
		return nil, err
	}

	// Collect gallery IDs
	galleryIDs := make([]string, 0, len(galleries))
	for _, g := range galleries {
		galleryIDs = append(galleryIDs, g.GalleryID)
	}

	// Get device distribution
	deviceDist, err := s.sessionRepo.GetDeviceDistribution(ctx, galleryIDs)
	if err != nil {
		return nil, err
	}

	// Get browser distribution
	browserDist, err := s.sessionRepo.GetBrowserDistribution(ctx, galleryIDs)
	if err != nil {
		return nil, err
	}

	// Calculate total for percentages
	var total int64
	for _, count := range browserDist {
		total += count
	}

	// Convert browser distribution to slice with percentages
	browsers := make([]BrowserDistribution, 0, len(browserDist))
	for browser, count := range browserDist {
		percentage := float64(0)
		if total > 0 {
			percentage = float64(count) / float64(total) * 100
		}
		browsers = append(browsers, BrowserDistribution{
			Browser:    browser,
			Count:      count,
			Percentage: percentage,
		})
	}

	// Sort browsers by count
	sort.Slice(browsers, func(i, j int) bool {
		return browsers[i].Count > browsers[j].Count
	})

	return &ClientBehaviorAnalytics{
		Devices: DeviceDistribution{
			Mobile:  deviceDist["mobile"],
			Tablet:  deviceDist["tablet"],
			Desktop: deviceDist["desktop"],
		},
		Browsers: browsers,
	}, nil
}
