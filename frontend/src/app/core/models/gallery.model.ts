export interface Gallery {
  galleryId: string;
  photographerId: string;
  name: string;
  description: string;
  customUrl: string;
  password: string;
  createdAt: string;
  expiresAt?: string;
  status: 'active' | 'expired' | 'archived';
  photoCount: number;
  totalSize: number;
  clientAccessCount: number;
}

export interface CreateGalleryRequest {
  name: string;
  description: string;
  customUrl: string;
  password: string;
  expiresAt?: string;
}

export interface UpdateGalleryRequest {
  name?: string;
  description?: string;
  password?: string;
  expiresAt?: string;
}
