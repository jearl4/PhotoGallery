import { Component, OnInit, inject, signal, computed } from '@angular/core';
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
  templateUrl: './gallery-view.component.html',
  styleUrl: './gallery-view.component.scss'
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
  selectedPhoto = signal<Photo | null>(null);
  downloadingPhoto = signal(false);
  bulkDownloading = signal(false);
  downloadProgress = signal(0);

  isSelectedPhotoFavorited = computed(() => {
    const photo = this.selectedPhoto();
    if (!photo) return false;
    return this.favorites().has(photo.photoId);
  });

  customUrl: string = '';

  ngOnInit(): void {
    this.customUrl = this.route.snapshot.paramMap.get('customUrl') || '';

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

    const photoId = photo.photoId;
    const wasAlreadyFavorited = this.favorites().has(photoId);

    this.favorites.update(currentFavorites => {
      const newFavorites = new Set(currentFavorites);
      if (newFavorites.has(photoId)) {
        newFavorites.delete(photoId);
      } else {
        newFavorites.add(photoId);
      }
      return newFavorites;
    });

    this.apiService.toggleFavorite(photoId).subscribe({
      next: (response: any) => {
        const shouldBeFavorited = response.isFavorited ?? response.favorited;
        const isFavoritedNow = this.favorites().has(photoId);

        if (shouldBeFavorited !== isFavoritedNow) {
          this.favorites.update(current => {
            const synced = new Set(current);
            if (shouldBeFavorited) {
              synced.add(photoId);
            } else {
              synced.delete(photoId);
            }
            return synced;
          });
        }
      },
      error: (err) => {
        console.error('Failed to toggle favorite:', err);
        this.favorites.update(current => {
          const reverted = new Set(current);
          if (wasAlreadyFavorited) {
            reverted.add(photoId);
          } else {
            reverted.delete(photoId);
          }
          return reverted;
        });
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
    this.selectedPhoto.set(photo);
  }

  closeViewer(): void {
    this.selectedPhoto.set(null);
  }

  logout(): void {
    this.sessionService.clearSession();
    this.router.navigate(['/']);
  }

  getThumbnailUrl(photo: Photo): string {
    return this.photoUrlService.getThumbnailUrl(photo);
  }

  getOptimizedUrl(photo: Photo): string {
    return this.photoUrlService.getOptimizedUrl(photo);
  }

  downloadPhoto(photo: Photo): void {
    this.downloadingPhoto.set(true);

    this.apiService.getPhotoDownloadUrl(photo.photoId).subscribe({
      next: (response) => {
        const link = document.createElement('a');
        link.href = response.downloadUrl;
        link.download = photo.fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.downloadingPhoto.set(false);
      },
      error: (err) => {
        console.error('Failed to get download URL:', err);
        alert('Failed to download photo. Please try again.');
        this.downloadingPhoto.set(false);
      }
    });
  }

  downloadAllFavorites(): void {
    const favoritePhotos = this.displayedPhotos();

    if (favoritePhotos.length === 0) {
      return;
    }

    if (!confirm(`Download ${favoritePhotos.length} photos? This may take a while.`)) {
      return;
    }

    this.bulkDownloading.set(true);
    this.downloadProgress.set(0);

    const downloadNext = (index: number) => {
      if (index >= favoritePhotos.length) {
        this.bulkDownloading.set(false);
        this.downloadProgress.set(0);
        return;
      }

      const photo = favoritePhotos[index];

      this.apiService.getPhotoDownloadUrl(photo.photoId).subscribe({
        next: (response) => {
          const link = document.createElement('a');
          link.href = response.downloadUrl;
          link.download = photo.fileName;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          this.downloadProgress.set(index + 1);
          setTimeout(() => downloadNext(index + 1), 500);
        },
        error: (err) => {
          console.error('Failed to download photo:', photo.fileName, err);
          this.downloadProgress.set(index + 1);
          setTimeout(() => downloadNext(index + 1), 500);
        }
      });
    };

    downloadNext(0);
  }
}
