import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Gallery, CreateGalleryRequest, UpdateGalleryRequest } from '../models/gallery.model';
import { Photo, UploadUrlResponse } from '../models/photo.model';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  // Photographer endpoints
  getMe(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/auth/me`);
  }

  // Gallery endpoints
  createGallery(request: CreateGalleryRequest): Observable<Gallery> {
    return this.http.post<Gallery>(`${this.baseUrl}/galleries`, request);
  }

  getGalleries(limit = 20, lastKey?: any): Observable<{ galleries: Gallery[], lastKey?: any }> {
    let params = new HttpParams().set('limit', limit.toString());
    if (lastKey) {
      params = params.set('lastKey', JSON.stringify(lastKey));
    }
    return this.http.get<{ galleries: Gallery[], lastKey?: any }>(`${this.baseUrl}/galleries`, { params });
  }

  getGallery(galleryId: string): Observable<Gallery> {
    return this.http.get<Gallery>(`${this.baseUrl}/galleries/${galleryId}`);
  }

  updateGallery(galleryId: string, request: UpdateGalleryRequest): Observable<Gallery> {
    return this.http.put<Gallery>(`${this.baseUrl}/galleries/${galleryId}`, request);
  }

  deleteGallery(galleryId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/galleries/${galleryId}`);
  }

  setGalleryExpiration(galleryId: string, expiresAt: string): Observable<Gallery> {
    return this.http.post<Gallery>(`${this.baseUrl}/galleries/${galleryId}/expire`, { expiresAt });
  }

  // Photo endpoints
  getUploadUrl(galleryId: string, fileName: string, mimeType: string): Observable<UploadUrlResponse> {
    return this.http.post<UploadUrlResponse>(
      `${this.baseUrl}/galleries/${galleryId}/photos/upload-url`,
      { fileName, mimeType }
    );
  }

  getGalleryPhotos(galleryId: string, limit = 50, lastKey?: any): Observable<{ photos: Photo[], lastKey?: any }> {
    let params = new HttpParams().set('limit', limit.toString());
    if (lastKey) {
      params = params.set('lastKey', JSON.stringify(lastKey));
    }
    return this.http.get<{ photos: Photo[], lastKey?: any }>(
      `${this.baseUrl}/galleries/${galleryId}/photos`,
      { params }
    );
  }

  deletePhoto(galleryId: string, photoId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/galleries/${galleryId}/photos/${photoId}`);
  }

  getGalleryFavorites(galleryId: string): Observable<{ favorites: any[] }> {
    return this.http.get<{ favorites: any[] }>(`${this.baseUrl}/galleries/${galleryId}/favorites`);
  }

  // Client endpoints
  verifyGalleryPassword(customUrl: string, password: string): Observable<{ sessionToken: string }> {
    return this.http.post<{ sessionToken: string }>(
      `${this.baseUrl}/client/verify`,
      { customUrl, password }
    );
  }

  getClientGallery(customUrl: string): Observable<Gallery> {
    return this.http.get<Gallery>(`${this.baseUrl}/client/galleries/${customUrl}`);
  }

  getClientGalleryPhotos(customUrl: string, limit = 50, lastKey?: any): Observable<{ photos: Photo[], lastKey?: any }> {
    let params = new HttpParams().set('limit', limit.toString());
    if (lastKey) {
      params = params.set('lastKey', JSON.stringify(lastKey));
    }
    return this.http.get<{ photos: Photo[], lastKey?: any }>(
      `${this.baseUrl}/client/galleries/${customUrl}/photos`,
      { params }
    );
  }

  getPhotoDownloadUrl(photoId: string): Observable<{ downloadUrl: string }> {
    return this.http.get<{ downloadUrl: string }>(`${this.baseUrl}/client/photos/${photoId}/download-url`);
  }

  toggleFavorite(photoId: string): Observable<{ isFavorited: boolean }> {
    return this.http.post<{ isFavorited: boolean }>(`${this.baseUrl}/client/photos/${photoId}/favorite`, {});
  }

  getClientFavorites(): Observable<{ favorites: any[] }> {
    return this.http.get<{ favorites: any[] }>(`${this.baseUrl}/client/session/favorites`);
  }
}
