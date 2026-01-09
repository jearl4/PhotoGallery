import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { PhotoUrlService } from '../../../core/services/photo-url.service';
import { Gallery } from '../../../core/models/gallery.model';
import { Photo } from '../../../core/models/photo.model';

@Component({
  selector: 'app-gallery-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './gallery-detail.component.html',
  styleUrl: './gallery-detail.component.scss'
})
export class GalleryDetailComponent implements OnInit {
  private apiService = inject(ApiService);
  private photoUrlService = inject(PhotoUrlService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  gallery = signal<Gallery | null>(null);
  photos = signal<Photo[]>([]);
  favorites = signal<any[]>([]);
  isLoading = signal(true);
  loadingPhotos = signal(false);
  showPassword = signal(false);
  urlCopied = signal(false);
  error = signal<string | null>(null);
  selectedPhoto = signal<Photo | null>(null);

  favoritePhotos = computed(() => {
    const favs = this.favorites();
    const allPhotos = this.photos();

    return favs.map(fav => {
      const photo = allPhotos.find(p => p.photoId === fav.photoId);
      return {
        ...fav,
        photo: photo
      };
    }).filter(fav => fav.photo);
  });

  galleryId!: string;

  ngOnInit(): void {
    this.galleryId = this.route.snapshot.paramMap.get('id')!;
    this.loadGallery();
    this.loadPhotos();
    this.loadFavorites();
  }

  loadGallery(): void {
    this.error.set(null);
    this.isLoading.set(true);
    this.apiService.getGallery(this.galleryId).subscribe({
      next: (gallery) => {
        this.gallery.set(gallery);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load gallery:', err);
        this.error.set(err.error?.message || 'Failed to load gallery. Please try again.');
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

  deleteGallery(): void {
    const gallery = this.gallery();
    if (!gallery) return;

    const photoCount = this.photos().length;
    const confirmMessage = photoCount > 0
      ? `Are you sure you want to delete "${gallery.name}"? This will permanently delete the gallery and all ${photoCount} photo${photoCount === 1 ? '' : 's'}. This action cannot be undone.`
      : `Are you sure you want to delete "${gallery.name}"? This action cannot be undone.`;

    if (confirm(confirmMessage)) {
      this.apiService.deleteGallery(this.galleryId).subscribe({
        next: () => {
          this.router.navigate(['/photographer/dashboard']);
        },
        error: (err) => {
          console.error('Failed to delete gallery:', err);
          alert('Failed to delete gallery. Please try again.');
        }
      });
    }
  }

  viewPhoto(photo: Photo): void {
    this.selectedPhoto.set(photo);
  }

  closeViewer(): void {
    this.selectedPhoto.set(null);
  }

  getOptimizedUrl(photo: Photo): string {
    return this.photoUrlService.getOptimizedUrl(photo);
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
    return this.photoUrlService.getThumbnailUrl(photo);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
