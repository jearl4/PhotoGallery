import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientSessionService } from '../../../core/services/client-session.service';
import { ApiService } from '../../../core/services/api.service';
import { PhotoUrlService } from '../../../core/services/photo-url.service';
import { Gallery } from '../../../core/models/gallery.model';
import { Photo } from '../../../core/models/photo.model';

@Component({
  selector: 'app-gallery-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="gallery-view">
      @if (isLoading()) {
        <div class="loading-container">
          <div class="spinner"></div>
          <p>Loading gallery...</p>
        </div>
      } @else if (gallery()) {
        <!-- Header -->
        <header class="header">
          <div class="header-content">
            <div class="header-left">
              <h1>{{ gallery()!.name }}</h1>
              @if (gallery()!.description) {
                <p class="description">{{ gallery()!.description }}</p>
              }
              <div class="gallery-meta">
                <span>{{ photos().length }} photos</span>
                @if (favoriteCount() > 0) {
                  <span>•</span>
                  <span>{{ favoriteCount() }} favorites</span>
                }
              </div>
            </div>

            <button class="btn btn-ghost" (click)="logout()">
              Exit Gallery
            </button>
          </div>
        </header>

        <!-- Filters -->
        <div class="filters">
          <div class="filter-buttons">
            <button
              class="filter-btn"
              [class.active]="viewMode() === 'all'"
              (click)="setViewMode('all')">
              All Photos
            </button>
            <button
              class="filter-btn"
              [class.active]="viewMode() === 'favorites'"
              (click)="setViewMode('favorites')">
              Favorites ({{ favoriteCount() }})
            </button>
          </div>
        </div>

        <!-- Photos Grid -->
        <div class="photos-container">
          @if (loadingPhotos()) {
            <div class="loading-photos">
              <div class="spinner"></div>
              <p>Loading photos...</p>
            </div>
          } @else if (displayedPhotos().length === 0) {
            <div class="empty-state">
              @if (viewMode() === 'favorites') {
                <div class="empty-icon">⭐</div>
                <h3>No favorites yet</h3>
                <p>Click the heart icon on photos to add them to your favorites</p>
              } @else {
                <div class="empty-icon">📷</div>
                <h3>No photos available</h3>
                <p>The photographer hasn't uploaded any photos yet</p>
              }
            </div>
          } @else {
            <div class="photos-grid">
              @for (photo of displayedPhotos(); track photo.photoId) {
                <div class="photo-card" (click)="viewPhoto(photo)">
                  <div class="photo-thumbnail">
                    <img
                      [src]="getThumbnailUrl(photo)"
                      [alt]="photo.fileName"
                      loading="lazy">

                    <button
                      class="favorite-btn"
                      [class.active]="isFavorite(photo.photoId)"
                      (click)="toggleFavorite(photo, $event)"
                      [title]="isFavorite(photo.photoId) ? 'Remove from favorites' : 'Add to favorites'">
                      {{ isFavorite(photo.photoId) ? '♥' : '♡' }}
                    </button>
                  </div>

                  <div class="photo-info">
                    @if (photo.favoriteCount > 0) {
                      <span class="favorite-count">{{ photo.favoriteCount }} ♥</span>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .gallery-view {
      min-height: 100vh;
      background: #f5f7fa;
    }

    .loading-container,
    .loading-photos {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #f0f0f0;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .header {
      background: white;
      border-bottom: 1px solid #e5e7eb;
      padding: 32px 0;
    }

    .header-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
    }

    h1 {
      margin: 0 0 8px 0;
      font-size: 32px;
      color: #1a1a1a;
    }

    .description {
      margin: 0 0 12px 0;
      font-size: 15px;
      color: #666;
      line-height: 1.5;
    }

    .gallery-meta {
      font-size: 14px;
      color: #999;
      display: flex;
      gap: 8px;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-ghost {
      background: transparent;
      color: #666;
      border: 1px solid #e5e7eb;
    }

    .btn-ghost:hover {
      background: #f5f7fa;
    }

    .filters {
      background: white;
      border-bottom: 1px solid #e5e7eb;
      padding: 16px 0;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .filter-buttons {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      gap: 8px;
    }

    .filter-btn {
      padding: 8px 16px;
      border: 1px solid #e5e7eb;
      background: white;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      color: #666;
    }

    .filter-btn:hover {
      background: #f5f7fa;
      border-color: #d1d5db;
    }

    .filter-btn.active {
      background: #667eea;
      color: white;
      border-color: #667eea;
    }

    .photos-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    .empty-state {
      text-align: center;
      padding: 80px 20px;
    }

    .empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      margin: 0 0 8px 0;
      font-size: 20px;
      color: #1a1a1a;
    }

    .empty-state p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .photos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
    }

    .photo-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s;
      border: 1px solid #e5e7eb;
    }

    .photo-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
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
      transition: transform 0.3s;
    }

    .photo-card:hover .photo-thumbnail img {
      transform: scale(1.05);
    }

    .favorite-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 40px;
      height: 40px;
      border: none;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 50%;
      cursor: pointer;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      z-index: 2;
    }

    .favorite-btn:hover {
      transform: scale(1.1);
      background: white;
    }

    .favorite-btn.active {
      color: #ef4444;
    }

    .photo-info {
      padding: 12px;
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .favorite-count {
      font-size: 13px;
      color: #ef4444;
      font-weight: 500;
    }

    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
      }

      .btn {
        width: 100%;
      }

      .photos-grid {
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }
    }

    @media (max-width: 480px) {
      .photos-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 12px;
      }
    }
  `]
})
export class GalleryViewComponent implements OnInit {
  private sessionService = inject(ClientSessionService);
  private apiService = inject(ApiService);
  private photoUrlService = inject(PhotoUrlService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  gallery = signal<Gallery | null>(null);
  photos = signal<Photo[]>([]);
  favorites = signal<Set<string>>(new Set());
  viewMode = signal<'all' | 'favorites'>('all');
  isLoading = signal(true);
  loadingPhotos = signal(false);

  customUrl: string = '';

  ngOnInit(): void {
    this.customUrl = this.route.snapshot.paramMap.get('customUrl') || '';

    // Verify session exists
    const session = this.sessionService.getSessionForGallery(this.customUrl);
    if (!session) {
      this.router.navigate(['/gallery', this.customUrl]);
      return;
    }

    this.gallery.set(session.gallery);
    this.isLoading.set(false);

    this.loadPhotos();
    this.loadFavorites();
  }

  loadPhotos(): void {
    this.loadingPhotos.set(true);

    this.apiService.getClientGalleryPhotos(this.customUrl).subscribe({
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
    this.apiService.getClientFavorites().subscribe({
      next: (response) => {
        const favoriteIds = new Set(response.favorites.map((f: any) => f.photoId));
        this.favorites.set(favoriteIds);
      },
      error: (err) => {
        console.error('Failed to load favorites:', err);
      }
    });
  }

  toggleFavorite(photo: Photo, event: Event): void {
    event.stopPropagation();

    this.apiService.toggleFavorite(photo.photoId).subscribe({
      next: (response) => {
        const newFavorites = new Set(this.favorites());
        if (response.isFavorited) {
          newFavorites.add(photo.photoId);
        } else {
          newFavorites.delete(photo.photoId);
        }
        this.favorites.set(newFavorites);
      },
      error: (err) => {
        console.error('Failed to toggle favorite:', err);
      }
    });
  }

  isFavorite(photoId: string): boolean {
    return this.favorites().has(photoId);
  }

  favoriteCount(): number {
    return this.favorites().size;
  }

  setViewMode(mode: 'all' | 'favorites'): void {
    this.viewMode.set(mode);
  }

  displayedPhotos(): Photo[] {
    if (this.viewMode() === 'favorites') {
      return this.photos().filter(p => this.isFavorite(p.photoId));
    }
    return this.photos();
  }

  viewPhoto(photo: Photo): void {
    // TODO: Open lightbox
    console.log('View photo:', photo);
  }

  logout(): void {
    this.sessionService.clearSession();
    this.router.navigate(['/']);
  }

  getThumbnailUrl(photo: Photo): string {
    return this.photoUrlService.getThumbnailUrl(photo);
  }
}
