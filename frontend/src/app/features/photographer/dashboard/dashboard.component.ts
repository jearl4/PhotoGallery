import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { Gallery } from '../../../core/models/gallery.model';
import { HeaderComponent } from '../../../shared/components/header/header.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private apiService = inject(ApiService);
  private router = inject(Router);

  user$ = this.authService.currentUser$;
  galleries = signal<Gallery[]>([]);
  isLoading = signal(true);

  ngOnInit(): void {
    this.loadGalleries();
  }

  loadGalleries(): void {
    this.isLoading.set(true);
    this.apiService.getGalleries().subscribe({
      next: (response) => {
        this.galleries.set(response.galleries ?? []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load galleries:', err);
        this.galleries.set([]);
        this.isLoading.set(false);
      }
    });
  }

  createGallery(): void {
    this.router.navigate(['/photographer/galleries/new']);
  }

  openGallery(galleryId: string): void {
    this.router.navigate(['/photographer/galleries', galleryId]);
  }

  logout(): void {
    this.authService.logout();
  }

  isExpired(gallery: Gallery): boolean {
    return gallery.expiresAt ? new Date(gallery.expiresAt) < new Date() : false;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();

    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffMs = dateDay.getTime() - nowDay.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays < 7) return `in ${diffDays} days`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getGalleryUrl(customUrl: string): string {
    return `${window.location.origin}/gallery/${customUrl}`;
  }
}
