/**
 * Mock Factory Functions for Testing
 * Provides factory functions to create consistent test data across all tests.
 */

import { Gallery, CreateGalleryRequest } from '../core/models/gallery.model';
import { Photo } from '../core/models/photo.model';
import { User } from '../core/models/user.model';

// Counter for generating unique IDs
let idCounter = 1;

/**
 * Reset the ID counter - call in beforeEach for test isolation
 */
export function resetIdCounter(): void {
  idCounter = 1;
}

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${idCounter++}`;
}

// ============= User Factories =============

export interface CreateMockUserOptions {
  userId?: string;
  email?: string;
  name?: string;
  provider?: 'google' | 'facebook' | 'apple';
}

export function createMockUser(options: CreateMockUserOptions = {}): User {
  return {
    userId: options.userId ?? generateId('user'),
    email: options.email ?? `user${idCounter}@example.com`,
    name: options.name ?? `Test User ${idCounter}`,
    provider: options.provider ?? 'google'
  };
}

// ============= Gallery Factories =============

export interface CreateMockGalleryOptions {
  galleryId?: string;
  photographerId?: string;
  userId?: string;
  name?: string;
  description?: string;
  customUrl?: string;
  password?: string;
  createdAt?: string;
  expiresAt?: string;
  status?: 'active' | 'expired';
  photoCount?: number;
  totalSize?: number;
  clientAccessCount?: number;
  enableWatermark?: boolean;
  watermarkText?: string;
  watermarkPosition?: 'bottom-right' | 'bottom-left' | 'center';
}

export function createMockGallery(options: CreateMockGalleryOptions = {}): Gallery {
  const id = options.galleryId ?? generateId('gal');
  const slug = options.customUrl ?? `gallery-${id.replace('gal_', '')}`;

  return {
    galleryId: id,
    photographerId: options.photographerId ?? options.userId ?? generateId('user'),
    userId: options.userId ?? options.photographerId ?? generateId('user'),
    name: options.name ?? `Test Gallery ${id}`,
    description: options.description ?? `Description for ${id}`,
    customUrl: slug,
    password: options.password ?? 'hashedPassword123',
    createdAt: options.createdAt ?? new Date().toISOString(),
    expiresAt: options.expiresAt,
    status: options.status ?? 'active',
    photoCount: options.photoCount ?? 0,
    totalSize: options.totalSize ?? 0,
    clientAccessCount: options.clientAccessCount ?? 0,
    enableWatermark: options.enableWatermark ?? false,
    watermarkText: options.watermarkText,
    watermarkPosition: options.watermarkPosition ?? 'bottom-right'
  };
}

export function createMockGalleryRequest(options: Partial<CreateGalleryRequest> = {}): CreateGalleryRequest {
  return {
    name: options.name ?? 'New Gallery',
    description: options.description,
    customUrl: options.customUrl,
    password: options.password ?? 'password123',
    expiresAt: options.expiresAt,
    enableWatermark: options.enableWatermark,
    watermarkText: options.watermarkText,
    watermarkPosition: options.watermarkPosition
  };
}

export function createMockGalleryList(count: number, baseOptions: CreateMockGalleryOptions = {}): Gallery[] {
  return Array.from({ length: count }, (_, i) =>
    createMockGallery({
      ...baseOptions,
      galleryId: generateId('gal'),
      name: baseOptions.name ? `${baseOptions.name} ${i + 1}` : undefined
    })
  );
}

export function createExpiredGallery(options: CreateMockGalleryOptions = {}): Gallery {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 7);

  return createMockGallery({
    ...options,
    expiresAt: pastDate.toISOString(),
    status: 'expired'
  });
}

export function createExpiringGallery(daysUntilExpiration: number, options: CreateMockGalleryOptions = {}): Gallery {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysUntilExpiration);

  return createMockGallery({
    ...options,
    expiresAt: futureDate.toISOString(),
    status: 'active'
  });
}

// ============= Photo Factories =============

export interface CreateMockPhotoOptions {
  photoId?: string;
  galleryId?: string;
  fileName?: string;
  originalKey?: string;
  optimizedKey?: string;
  thumbnailKey?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  uploadedAt?: string;
  favoriteCount?: number;
  downloadCount?: number;
  metadata?: Record<string, any>;
}

export function createMockPhoto(options: CreateMockPhotoOptions = {}): Photo {
  const id = options.photoId ?? generateId('photo');
  const galleryId = options.galleryId ?? generateId('gal');
  const fileName = options.fileName ?? `image_${id}.jpg`;

  return {
    photoId: id,
    galleryId: galleryId,
    fileName: fileName,
    originalKey: options.originalKey ?? `${galleryId}/${id}/original/${fileName}`,
    optimizedKey: options.optimizedKey ?? `${galleryId}/${id}/optimized/${fileName}`,
    thumbnailKey: options.thumbnailKey ?? `${galleryId}/${id}/thumbnail/${fileName}`,
    mimeType: options.mimeType ?? 'image/jpeg',
    size: options.size ?? 1024 * 1024, // 1MB default
    width: options.width ?? 1920,
    height: options.height ?? 1080,
    uploadedAt: options.uploadedAt ?? new Date().toISOString(),
    favoriteCount: options.favoriteCount ?? 0,
    downloadCount: options.downloadCount ?? 0,
    metadata: options.metadata
  };
}

export function createMockPhotoList(count: number, galleryId?: string): Photo[] {
  const gId = galleryId ?? generateId('gal');
  return Array.from({ length: count }, () =>
    createMockPhoto({ galleryId: gId })
  );
}

// ============= Favorite Factories =============

export interface MockFavorite {
  photoId: string;
  favoritedAt: string;
  sessionId?: string;
}

export function createMockFavorite(photoId?: string): MockFavorite {
  return {
    photoId: photoId ?? generateId('photo'),
    favoritedAt: new Date().toISOString(),
    sessionId: generateId('session')
  };
}

export function createMockFavoriteList(photoIds: string[]): MockFavorite[] {
  return photoIds.map(id => createMockFavorite(id));
}

// ============= Upload Factories =============

export interface MockUploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'cancelled';
  errorMessage?: string;
  photoId?: string;
}

export function createMockFile(name: string = 'test.jpg', size: number = 1024 * 1024, type: string = 'image/jpeg'): File {
  const blob = new Blob([''], { type });
  Object.defineProperty(blob, 'size', { value: size });
  return new File([blob], name, { type });
}

export function createMockUploadFile(options: Partial<MockUploadFile> = {}): MockUploadFile {
  return {
    file: options.file ?? createMockFile(),
    progress: options.progress ?? 0,
    status: options.status ?? 'pending',
    errorMessage: options.errorMessage,
    photoId: options.photoId
  };
}

// ============= API Response Factories =============

export interface MockGalleriesResponse {
  galleries: Gallery[];
  lastKey?: string;
}

export interface MockPhotosResponse {
  photos: Photo[];
  lastKey?: string;
}

export interface MockFavoritesResponse {
  favorites: MockFavorite[];
}

export interface MockUploadUrlResponse {
  photoId: string;
  uploadUrl: string;
  key: string;
}

export function createMockGalleriesResponse(galleries: Gallery[], lastKey?: string): MockGalleriesResponse {
  return { galleries, lastKey };
}

export function createMockPhotosResponse(photos: Photo[], lastKey?: string): MockPhotosResponse {
  return { photos, lastKey };
}

export function createMockFavoritesResponse(favorites: MockFavorite[]): MockFavoritesResponse {
  return { favorites };
}

export function createMockUploadUrlResponse(photoId?: string): MockUploadUrlResponse {
  const id = photoId ?? generateId('photo');
  return {
    photoId: id,
    uploadUrl: `https://s3.amazonaws.com/bucket/upload/${id}?signature=xxx`,
    key: `galleries/gal_1/${id}/original/image.jpg`
  };
}

// ============= Session Factories =============

export interface MockClientSession {
  sessionToken: string;
  gallery: Gallery;
  customUrl: string;
  expiresAt: string;
}

export function createMockClientSession(gallery?: Gallery): MockClientSession {
  const g = gallery ?? createMockGallery();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  return {
    sessionToken: `session_${generateId('token')}`,
    gallery: g,
    customUrl: g.customUrl,
    expiresAt: expiresAt.toISOString()
  };
}
