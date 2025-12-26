export interface Photo {
  photoId: string;
  galleryId: string;
  fileName: string;
  originalKey: string;
  optimizedKey: string;
  thumbnailKey: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  uploadedAt: string;
  favoriteCount: number;
  downloadCount: number;
  metadata?: Record<string, string>;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  photoId: string;
  fields: Record<string, string>;
}
