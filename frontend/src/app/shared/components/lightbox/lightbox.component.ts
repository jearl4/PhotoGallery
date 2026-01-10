import { Component, Input, Output, EventEmitter, signal, HostListener, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Photo } from '../../../core/models/gallery.model';
import { PhotoUrlService } from '../../../core/services/photo-url.service';

@Component({
  selector: 'app-lightbox',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lightbox.component.html',
  styleUrl: './lightbox.component.scss'
})
export class LightboxComponent implements OnInit, OnDestroy {
  private photoUrlService = inject(PhotoUrlService);

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
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
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
    return this.photoUrlService.getOptimizedUrl(photo);
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
