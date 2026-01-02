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
  enableWatermark: boolean;
  watermarkText?: string;
  watermarkPosition?: 'bottom-right' | 'bottom-left' | 'center';
}

export interface CreateGalleryRequest {
  name: string;
  description: string;
  customUrl: string;
  password: string;
  expiresAt?: string;
  enableWatermark?: boolean;
  watermarkText?: string;
  watermarkPosition?: 'bottom-right' | 'bottom-left' | 'center';
}

export interface UpdateGalleryRequest {
  name?: string;
  description?: string;
  password?: string;
  expiresAt?: string;
  enableWatermark?: boolean;
  watermarkText?: string;
  watermarkPosition?: 'bottom-right' | 'bottom-left' | 'center';
}
