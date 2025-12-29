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
  styles: [`
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(var(--columns, 3), 1fr);
      gap: 16px;
      padding: 0;
    }

    @media (max-width: 1024px) {
      .photo-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .photo-grid {
        grid-template-columns: 1fr;
      }
    }

    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px 20px;
    }

    .empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
      opacity: 0.3;
    }

    .empty-state p {
      color: #666;
      font-size: 16px;
      margin: 0;
    }

    .photo-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid #e5e7eb;
    }

    .photo-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .photo-thumbnail {
      position: relative;
      aspect-ratio: 1;
      background: #f5f7fa;
      overflow: hidden;
    }

    .photo-thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .photo-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      opacity: 0;
      transition: opacity 0.2s;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      padding: 8px;
      gap: 8px;
    }

    .photo-card:hover .photo-overlay {
      opacity: 1;
    }

    .overlay-btn {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background: white;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .overlay-btn:hover {
      transform: scale(1.1);
    }

    .favorite-btn.favorited {
      background: #fee2e2;
    }

    .delete-btn:hover {
      background: #fee2e2;
    }

    .photo-metadata {
      padding: 12px;
    }

    .photo-filename {
      font-size: 13px;
      font-weight: 500;
      color: #1a1a1a;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .photo-details {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #666;
    }

    .detail {
      display: inline-flex;
      align-items: center;
    }
  `]
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
