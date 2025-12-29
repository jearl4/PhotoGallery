import { Component, Input, Output, EventEmitter, signal, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Photo } from '../../../core/models/gallery.model';

@Component({
  selector: 'app-lightbox',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen()) {
      <div class="lightbox-overlay" (click)="onOverlayClick($event)">
        <!-- Close Button -->
        <button class="lightbox-btn close-btn" (click)="close()" title="Close (Esc)">
          ✕
        </button>

        <!-- Navigation -->
        @if (photos().length > 1) {
          <button
            class="lightbox-btn nav-btn prev-btn"
            (click)="previous($event)"
            [disabled]="currentIndex() === 0"
            title="Previous (←)">
            ←
          </button>

          <button
            class="lightbox-btn nav-btn next-btn"
            (click)="next($event)"
            [disabled]="currentIndex() === photos().length - 1"
            title="Next (→)">
            →
          </button>
        }

        <!-- Image Container -->
        <div class="lightbox-content">
          @if (currentPhoto()) {
            <img
              [src]="getImageUrl()"
              [alt]="currentPhoto()!.fileName"
              class="lightbox-image"
              [class.zoomed]="isZoomed()"
              (click)="toggleZoom($event)"
              (load)="onImageLoad()"
              (error)="onImageError()">

            @if (isLoading()) {
              <div class="loading-spinner"></div>
            }

            @if (hasError()) {
              <div class="error-message">Failed to load image</div>
            }
          }
        </div>

        <!-- Info Bar -->
        @if (currentPhoto() && showInfo()) {
          <div class="lightbox-info">
            <div class="info-left">
              <div class="photo-name">{{ currentPhoto()!.fileName }}</div>
              @if (currentPhoto()!.metadata) {
                <div class="photo-details">
                  @if (currentPhoto()!.metadata.width && currentPhoto()!.metadata.height) {
                    <span>{{ currentPhoto()!.metadata.width }} × {{ currentPhoto()!.metadata.height }}</span>
                  }
                  @if (currentPhoto()!.metadata.size) {
                    <span>{{ formatFileSize(currentPhoto()!.metadata.size) }}</span>
                  }
                </div>
              }
            </div>

            <div class="info-right">
              @if (photos().length > 1) {
                <span class="photo-count">{{ currentIndex() + 1 }} / {{ photos().length }}</span>
              }
              @if (showDownload()) {
                <button class="info-btn" (click)="download($event)" title="Download">
                  ⬇
                </button>
              }
              @if (showFavorite()) {
                <button
                  class="info-btn"
                  [class.favorited]="isFavorite()"
                  (click)="toggleFavorite($event)"
                  title="{{ isFavorite() ? 'Remove from favorites' : 'Add to favorites' }}">
                  {{ isFavorite() ? '❤️' : '🤍' }}
                </button>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .lightbox-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.95);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .lightbox-content {
      position: relative;
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .lightbox-image {
      max-width: 100%;
      max-height: 90vh;
      object-fit: contain;
      cursor: zoom-in;
      transition: transform 0.3s ease;
    }

    .lightbox-image.zoomed {
      cursor: zoom-out;
      transform: scale(1.5);
    }

    .loading-spinner {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255, 255, 255, 0.2);
      border-top: 4px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: translate(-50%, -50%) rotate(0deg); }
      100% { transform: translate(-50%, -50%) rotate(360deg); }
    }

    .error-message {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 18px;
      text-align: center;
    }

    .lightbox-btn {
      position: fixed;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.3);
      color: white;
      cursor: pointer;
      transition: all 0.2s;
      backdrop-filter: blur(10px);
    }

    .lightbox-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.5);
    }

    .lightbox-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .close-btn {
      top: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .nav-btn {
      top: 50%;
      transform: translateY(-50%);
      width: 56px;
      height: 56px;
      border-radius: 50%;
      font-size: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .prev-btn {
      left: 20px;
    }

    .next-btn {
      right: 20px;
    }

    .lightbox-info {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: white;
    }

    .info-left {
      flex: 1;
    }

    .photo-name {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .photo-details {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.7);
      display: flex;
      gap: 16px;
    }

    .info-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .photo-count {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
    }

    .info-btn {
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      font-size: 18px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .info-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.1);
    }

    .info-btn.favorited {
      background: rgba(239, 68, 68, 0.2);
    }

    @media (max-width: 768px) {
      .close-btn {
        top: 12px;
        right: 12px;
        width: 40px;
        height: 40px;
        font-size: 20px;
      }

      .nav-btn {
        width: 44px;
        height: 44px;
        font-size: 24px;
      }

      .prev-btn {
        left: 12px;
      }

      .next-btn {
        right: 12px;
      }

      .lightbox-info {
        padding: 16px;
      }

      .photo-name {
        font-size: 14px;
      }

      .photo-details {
        font-size: 12px;
      }
    }
  `]
})
export class LightboxComponent implements OnInit, OnDestroy {
  @Input() photos = signal<Photo[]>([]);
  @Input() initialIndex = signal<number>(0);
  @Input() favorites = signal<Set<string>>(new Set());
  @Input() showInfo = signal<boolean>(true);
  @Input() showDownload = signal<boolean>(false);
  @Input() showFavorite = signal<boolean>(false);

  @Output() closed = new EventEmitter<void>();
  @Output() favoriteToggled = new EventEmitter<Photo>();
  @Output() downloadRequested = new EventEmitter<Photo>();

  isOpen = signal<boolean>(false);
  currentIndex = signal<number>(0);
  currentPhoto = signal<Photo | null>(null);
  isLoading = signal<boolean>(true);
  hasError = signal<boolean>(false);
  isZoomed = signal<boolean>(false);

  ngOnInit(): void {
    this.currentIndex.set(this.initialIndex());
    this.updateCurrentPhoto();
    this.isOpen.set(true);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    // Restore body scroll
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.isOpen()) return;

    switch (event.key) {
      case 'Escape':
        this.close();
        break;
      case 'ArrowLeft':
        this.previous();
        break;
      case 'ArrowRight':
        this.next();
        break;
    }
  }

  private updateCurrentPhoto(): void {
    const photos = this.photos();
    const index = this.currentIndex();
    if (photos && index >= 0 && index < photos.length) {
      this.currentPhoto.set(photos[index]);
      this.isLoading.set(true);
      this.hasError.set(false);
      this.isZoomed.set(false);
    }
  }

  getImageUrl(): string {
    const photo = this.currentPhoto();
    if (!photo) return '';
    return photo.optimizedUrl || photo.originalUrl;
  }

  onOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  close(): void {
    this.isOpen.set(false);
    document.body.style.overflow = '';
    this.closed.emit();
  }

  previous(event?: Event): void {
    event?.stopPropagation();
    const index = this.currentIndex();
    if (index > 0) {
      this.currentIndex.set(index - 1);
      this.updateCurrentPhoto();
    }
  }

  next(event?: Event): void {
    event?.stopPropagation();
    const index = this.currentIndex();
    if (index < this.photos().length - 1) {
      this.currentIndex.set(index + 1);
      this.updateCurrentPhoto();
    }
  }

  toggleZoom(event: Event): void {
    event.stopPropagation();
    this.isZoomed.set(!this.isZoomed());
  }

  toggleFavorite(event: Event): void {
    event.stopPropagation();
    const photo = this.currentPhoto();
    if (photo) {
      this.favoriteToggled.emit(photo);
    }
  }

  download(event: Event): void {
    event.stopPropagation();
    const photo = this.currentPhoto();
    if (photo) {
      this.downloadRequested.emit(photo);
    }
  }

  isFavorite(): boolean {
    const photo = this.currentPhoto();
    return photo ? this.favorites().has(photo.photoId) : false;
  }

  onImageLoad(): void {
    this.isLoading.set(false);
    this.hasError.set(false);
  }

  onImageError(): void {
    this.isLoading.set(false);
    this.hasError.set(true);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
