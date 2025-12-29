import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { Gallery } from '../../../core/models/gallery.model';
import { Photo } from '../../../core/models/photo.model';

@Component({
  selector: 'app-gallery-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="gallery-detail">
      @if (isLoading()) {
        <div class="loading-container">
          <div class="spinner"></div>
          <p>Loading gallery...</p>
        </div>
      } @else if (gallery()) {
        <!-- Header -->
        <div class="header">
          <div class="header-content">
            <button class="btn-back" (click)="goBack()">
              ← Back to Dashboard
            </button>

            <div class="header-info">
              <div class="header-left">
                <h1>{{ gallery()!.name }}</h1>
                @if (gallery()!.description) {
                  <p class="description">{{ gallery()!.description }}</p>
                }

                <div class="gallery-meta">
                  <div class="meta-item">
                    <span class="meta-icon">📷</span>
                    <span>{{ gallery()!.photoCount }} photos</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-icon">👁</span>
                    <span>{{ gallery()!.clientAccessCount }} views</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-icon">⭐</span>
                    <span>{{ favoriteCount() }} favorites</span>
                  </div>
                </div>
              </div>

              <div class="header-actions">
                <button class="btn btn-secondary" (click)="editGallery()">
                  Edit Gallery
                </button>
                <button class="btn btn-primary" (click)="uploadPhotos()">
                  <span class="btn-icon">+</span>
                  Upload Photos
                </button>
              </div>
            </div>

            <!-- Gallery URL and Status -->
            <div class="gallery-info-cards">
              <div class="info-card">
                <div class="info-label">Gallery URL</div>
                <div class="info-value url-value">
                  <code>{{ getGalleryUrl() }}</code>
                  <button class="btn-copy" (click)="copyUrl()" [title]="'Copy URL'">
                    {{ urlCopied() ? '✓' : '📋' }}
                  </button>
                </div>
              </div>

              <div class="info-card">
                <div class="info-label">Password</div>
                <div class="info-value">
                  {{ showPassword() ? '••••••••' : '••••••••' }}
                  <button class="btn-copy" (click)="togglePassword()">
                    {{ showPassword() ? '👁' : '👁' }}
                  </button>
                </div>
              </div>

              <div class="info-card">
                <div class="info-label">Status</div>
                <div class="info-value">
                  @if (isExpired()) {
                    <span class="status-badge status-expired">Expired</span>
                  } @else if (gallery()!.expiresAt) {
                    <span class="status-badge status-expires">
                      Expires {{ formatDate(gallery()!.expiresAt) }}
                    </span>
                  } @else {
                    <span class="status-badge status-active">Active</span>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Photos Grid -->
        <div class="photos-section">
          <div class="section-header">
            <h2>Photos</h2>
            @if (photos().length > 0) {
              <span class="photo-count">{{ photos().length }} of {{ gallery()!.photoCount }}</span>
            }
          </div>

          @if (loadingPhotos()) {
            <div class="loading-photos">
              <div class="spinner"></div>
              <p>Loading photos...</p>
            </div>
          } @else if (photos().length === 0) {
            <div class="empty-photos">
              <div class="empty-icon">📷</div>
              <h3>No photos yet</h3>
              <p>Upload photos to share with your client</p>
              <button class="btn btn-primary" (click)="uploadPhotos()">
                <span class="btn-icon">+</span>
                Upload Photos
              </button>
            </div>
          } @else {
            <div class="photos-grid">
              @for (photo of photos(); track photo.photoId) {
                <div class="photo-card">
                  <div class="photo-thumbnail">
                    <img
                      [src]="getThumbnailUrl(photo)"
                      [alt]="photo.fileName"
                      loading="lazy">

                    <div class="photo-overlay">
                      <button class="btn-icon-overlay" (click)="viewPhoto(photo)" title="View">
                        👁
                      </button>
                      <button class="btn-icon-overlay" (click)="deletePhoto(photo)" title="Delete">
                        🗑
                      </button>
                    </div>
                  </div>

                  <div class="photo-info">
                    <div class="photo-name">{{ photo.fileName }}</div>
                    <div class="photo-stats">
                      <span>{{ formatFileSize(photo.size) }}</span>
                      <span>•</span>
                      <span>{{ photo.favoriteCount }} ♥</span>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Favorites Section -->
        @if (favorites().length > 0) {
          <div class="favorites-section">
            <div class="section-header">
              <h2>Client Favorites</h2>
              <span class="photo-count">{{ favorites().length }} photos</span>
            </div>

            <div class="favorites-grid">
              @for (favorite of favorites(); track favorite.photoId) {
                <div class="favorite-card">
                  <div class="favorite-info">
                    <div>Photo {{ favorite.photoId.substring(0, 8) }}</div>
                    <div class="favorite-date">
                      {{ formatDate(favorite.favoritedAt) }}
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .gallery-detail {
      min-height: 100vh;
      background: #f5f7fa;
    }

    .loading-container,
    .loading-photos {
      text-align: center;
      padding: 80px 20px;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #f0f0f0;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .header {
      background: white;
      border-bottom: 1px solid #e5e7eb;
      padding: 24px 0;
    }

    .header-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 24px;
    }

    .btn-back {
      background: none;
      border: none;
      color: #667eea;
      font-size: 14px;
      cursor: pointer;
      padding: 0;
      margin-bottom: 20px;
      display: inline-block;
    }

    .btn-back:hover {
      text-decoration: underline;
    }

    .header-info {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      margin-bottom: 24px;
    }

    h1 {
      margin: 0 0 8px 0;
      font-size: 32px;
      color: #1a1a1a;
    }

    .description {
      margin: 0 0 16px 0;
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    }

    .gallery-meta {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #666;
    }

    .meta-icon {
      font-size: 16px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
      flex-shrink: 0;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover {
      background: #5568d3;
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: #f5f7fa;
      color: #666;
      border: 1px solid #e5e7eb;
    }

    .btn-secondary:hover {
      background: #e5e7eb;
    }

    .btn-icon {
      font-size: 18px;
    }

    .gallery-info-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }

    .info-card {
      background: #f5f7fa;
      padding: 16px;
      border-radius: 8px;
    }

    .info-label {
      font-size: 12px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .info-value {
      font-size: 14px;
      color: #1a1a1a;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .url-value code {
      background: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn-copy {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }

    .btn-copy:hover {
      background: #f5f7fa;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .status-active {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .status-expires {
      background: #fff3e0;
      color: #ef6c00;
    }

    .status-expired {
      background: #ffebee;
      color: #c62828;
    }

    .photos-section,
    .favorites-section {
      max-width: 1400px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .section-header h2 {
      margin: 0;
      font-size: 24px;
      color: #1a1a1a;
    }

    .photo-count {
      font-size: 14px;
      color: #666;
    }

    .empty-photos {
      text-align: center;
      padding: 80px 20px;
      background: white;
      border-radius: 12px;
    }

    .empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }

    .empty-photos h3 {
      margin: 0 0 8px 0;
      font-size: 20px;
      color: #1a1a1a;
    }

    .empty-photos p {
      margin: 0 0 24px 0;
      color: #666;
    }

    .photos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 20px;
    }

    .photo-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      transition: all 0.2s;
      border: 1px solid #e5e7eb;
    }

    .photo-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .photo-thumbnail {
      aspect-ratio: 4 / 3;
      background: #f5f7fa;
      position: relative;
      overflow: hidden;
    }

    .photo-thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .photo-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .photo-card:hover .photo-overlay {
      opacity: 1;
    }

    .btn-icon-overlay {
      width: 40px;
      height: 40px;
      border: none;
      background: white;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .btn-icon-overlay:hover {
      transform: scale(1.1);
    }

    .photo-info {
      padding: 12px;
    }

    .photo-name {
      font-size: 13px;
      color: #1a1a1a;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .photo-stats {
      font-size: 12px;
      color: #666;
      display: flex;
      gap: 6px;
    }

    .favorites-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }

    .favorite-card {
      background: white;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .favorite-info {
      font-size: 13px;
      color: #666;
    }

    .favorite-date {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }

    @media (max-width: 768px) {
      .header-info {
        flex-direction: column;
      }

      .header-actions {
        width: 100%;
      }

      .btn {
        flex: 1;
      }

      .photos-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 12px;
      }
    }
  `]
})
export class GalleryDetailComponent implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  gallery = signal<Gallery | null>(null);
  photos = signal<Photo[]>([]);
  favorites = signal<any[]>([]);
  isLoading = signal(true);
  loadingPhotos = signal(false);
  showPassword = signal(false);
  urlCopied = signal(false);

  galleryId!: string;

  ngOnInit(): void {
    this.galleryId = this.route.snapshot.paramMap.get('id')!;
    this.loadGallery();
    this.loadPhotos();
    this.loadFavorites();
  }

  loadGallery(): void {
    this.apiService.getGallery(this.galleryId).subscribe({
      next: (gallery) => {
        this.gallery.set(gallery);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load gallery:', err);
        this.isLoading.set(false);
      }
    });
  }

  loadPhotos(): void {
    this.loadingPhotos.set(true);
    this.apiService.getGalleryPhotos(this.galleryId).subscribe({
      next: (response) => {
        this.photos.set(response.photos);
        this.loadingPhotos.set(false);
      },
      error: (err) => {
        console.error('Failed to load photos:', err);
        this.loadingPhotos.set(false);
      }
    });
  }

  loadFavorites(): void {
    this.apiService.getGalleryFavorites(this.galleryId).subscribe({
      next: (response) => {
        this.favorites.set(response.favorites);
      },
      error: (err) => {
        console.error('Failed to load favorites:', err);
      }
    });
  }

  favoriteCount(): number {
    return this.favorites().length;
  }

  uploadPhotos(): void {
    this.router.navigate(['/photographer/galleries', this.galleryId, 'upload']);
  }

  editGallery(): void {
    this.router.navigate(['/photographer/galleries', this.galleryId, 'edit']);
  }

  viewPhoto(photo: Photo): void {
    // TODO: Open lightbox
    console.log('View photo:', photo);
  }

  deletePhoto(photo: Photo): void {
    if (confirm(`Delete ${photo.fileName}?`)) {
      this.apiService.deletePhoto(this.galleryId, photo.photoId).subscribe({
        next: () => {
          this.photos.set(this.photos().filter(p => p.photoId !== photo.photoId));
          const gallery = this.gallery();
          if (gallery) {
            gallery.photoCount--;
            this.gallery.set({ ...gallery });
          }
        },
        error: (err) => {
          console.error('Failed to delete photo:', err);
          alert('Failed to delete photo');
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/photographer/dashboard']);
  }

  getGalleryUrl(): string {
    const customUrl = this.gallery()?.customUrl || '';
    return `${window.location.origin}/gallery/${customUrl}`;
  }

  copyUrl(): void {
    navigator.clipboard.writeText(this.getGalleryUrl()).then(() => {
      this.urlCopied.set(true);
      setTimeout(() => this.urlCopied.set(false), 2000);
    });
  }

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  isExpired(): boolean {
    const gallery = this.gallery();
    return gallery?.expiresAt ? new Date(gallery.expiresAt) < new Date() : false;
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getThumbnailUrl(photo: Photo): string {
    // TODO: Return actual thumbnail URL from CDN
    return `https://via.placeholder.com/400x300?text=${encodeURIComponent(photo.fileName)}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
