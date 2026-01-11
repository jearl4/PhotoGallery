import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Photo } from '../models/photo.model';

@Injectable({
  providedIn: 'root'
})
export class PhotoUrlService {
  private cdnUrl = environment.cdnUrl;

  /**
   * Generate thumbnail URL from S3 key
   */
  getThumbnailUrl(photo: Photo): string {
    if (photo.thumbnailKey) {
      return `${this.cdnUrl}/${photo.thumbnailKey}`;
    }
    // Fallback to optimized if thumbnail not available yet
    return this.getOptimizedUrl(photo);
  }

  /**
   * Generate optimized image URL from S3 key
   */
  getOptimizedUrl(photo: Photo): string {
    if (photo.optimizedKey) {
      return `${this.cdnUrl}/${photo.optimizedKey}`;
    }
    // Fallback to original if optimized not available yet
    return this.getOriginalUrl(photo);
  }

  /**
   * Generate original image URL from S3 key
   */
  getOriginalUrl(photo: Photo): string {
    if (photo.originalKey) {
      return `${this.cdnUrl}/${photo.originalKey}`;
    }
    // Return empty string if no keys available
    return '';
  }

  /**
   * Get the best available URL for a photo
   * Prioritizes: thumbnail -> optimized -> original
   */
  getBestAvailableUrl(photo: Photo): string {
    return this.getThumbnailUrl(photo);
  }

  /**
   * Generate URL directly from an S3 key
   */
  getUrlFromKey(key: string): string {
    if (!key) return '';
    return `${this.cdnUrl}/${key}`;
  }
}
