export interface DashboardSummary {
  totalViews: number;
  totalDownloads: number;
  totalFavorites: number;
  totalPhotos: number;
  totalGalleries: number;
  activeGalleries: number;
  totalStorageBytes: number;
  totalClients: number;
}

export interface GalleryAnalytics {
  galleryId: string;
  name: string;
  photoCount: number;
  totalSize: number;
  viewCount: number;
  downloadCount: number;
  favoriteCount: number;
  uniqueClients: number;
  clientAccessCount: number;
  lastClientAccessAt?: string;
  createdAt: string;
  status: string;
}

export interface TopPhoto {
  photoId: string;
  galleryId: string;
  galleryName: string;
  fileName: string;
  thumbnailKey: string;
  favoriteCount: number;
  downloadCount: number;
}

export interface DeviceDistribution {
  mobile: number;
  tablet: number;
  desktop: number;
}

export interface BrowserDistribution {
  browser: string;
  count: number;
  percentage: number;
}

export interface ClientBehaviorAnalytics {
  devices: DeviceDistribution;
  browsers: BrowserDistribution[];
}

export interface GalleriesAnalyticsResponse {
  galleries: GalleryAnalytics[];
}

export interface TopPhotosResponse {
  photos: TopPhoto[];
}
