import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Photo } from '../../../core/models/gallery.model';
import { PhotoUrlService } from '../../../core/services/photo-url.service';

export interface PhotoGridConfig {
  showFavoriteButton?: boolean;
  showDeleteButton?: boolean;
  showMetadata?: boolean;
  columns?: number;
}

@Component({
  selector: 'app-photo-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="photo-grid" [style.--columns]="config().columns || 3">
      @if (photos().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">📷</div>
          <p>{{ emptyMessage() }}</p>
        </div>
      } @else {
        @for (photo of photos(); track photo.photoId) {
          <div class="photo-card" (click)="onPhotoClick(photo)">
            <!-- Photo Thumbnail -->
            <div class="photo-thumbnail">
              <img
                [src]="getThumbnailUrl(photo)"
                [alt]="photo.fileName"
                loading="lazy"
                (error)="onImageError($event)">

              <!-- Overlay Actions -->
              <div class="photo-overlay">
                @if (config().showFavoriteButton) {
                  <button
                    class="overlay-btn favorite-btn"
                    [class.favorited]="isFavorite(photo.photoId)"
                    (click)="onFavoriteClick(photo, $event)"
                    title="{{ isFavorite(photo.photoId) ? 'Remove from favorites' : 'Add to favorites' }}">
                    {{ isFavorite(photo.photoId) ? '❤️' : '🤍' }}
                  </button>
                }
                @if (config().showDeleteButton) {
                  <button
                    class="overlay-btn delete-btn"
                    (click)="onDeleteClick(photo, $event)"
                    title="Delete photo">
                    🗑️
                  </button>
                }
              </div>
            </div>

            <!-- Photo Metadata -->
            @if (config().showMetadata) {
              <div class="photo-metadata">
                <div class="photo-filename">{{ photo.fileName }}</div>
                @if (photo.metadata) {
                  <div class="photo-details">
                    @if (photo.metadata.width && photo.metadata.height) {
                      <span class="detail">{{ photo.metadata.width }} × {{ photo.metadata.height }}</span>
                    }
                    @if (photo.metadata.size) {
                      <span class="detail">{{ formatFileSize(photo.metadata.size) }}</span>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styleUrl: './photo-grid.component.scss'
})
export class PhotoGridComponent {
  private photoUrlService = inject(PhotoUrlService);

  @Input() photos = signal<Photo[]>([]);
  @Input() favorites = signal<Set<string>>(new Set());
  @Input() config = signal<PhotoGridConfig>({});
  @Input() emptyMessage = signal<string>('No photos yet');

  @Output() photoClick = new EventEmitter<Photo>();
  @Output() favoriteClick = new EventEmitter<Photo>();
  @Output() deleteClick = new EventEmitter<Photo>();

  isFavorite(photoId: string): boolean {
    return this.favorites().has(photoId);
  }

  getThumbnailUrl(photo: Photo): string {
    return this.photoUrlService.getThumbnailUrl(photo);
  }

  onPhotoClick(photo: Photo): void {
    this.photoClick.emit(photo);
  }

  onFavoriteClick(photo: Photo, event: Event): void {
    event.stopPropagation();
    this.favoriteClick.emit(photo);
  }

  onDeleteClick(photo: Photo, event: Event): void {
    event.stopPropagation();
    this.deleteClick.emit(photo);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage Error%3C/text%3E%3C/svg%3E';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
