import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { Gallery } from '../../../core/models/gallery.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard">
      <!-- Header -->
      <header class="header">
        <div class="header-content">
          <div class="header-left">
            <h1>Photographer Gallery</h1>
            @if (user$ | async; as user) {
              <p class="user-email">{{ user.email }}</p>
            }
          </div>
          <button class="btn btn-ghost" (click)="logout()">
            Sign Out
          </button>
        </div>
      </header>

      <!-- Main Content -->
      <main class="main">
        <div class="container">
          <!-- Page Title -->
          <div class="page-header">
            <h2>My Galleries</h2>
            <button class="btn btn-primary" (click)="createGallery()">
              <span class="btn-icon">+</span>
              New Gallery
            </button>
          </div>

          <!-- Loading State -->
          @if (isLoading()) {
            <div class="loading-container">
              <div class="spinner"></div>
              <p>Loading galleries...</p>
            </div>
          }

          <!-- Empty State -->
          @else if (galleries().length === 0) {
            <div class="empty-state">
              <div class="empty-icon">📸</div>
              <h3>No galleries yet</h3>
              <p>Create your first gallery to start sharing photos with clients</p>
              <button class="btn btn-primary" (click)="createGallery()">
                <span class="btn-icon">+</span>
                Create Gallery
              </button>
            </div>
          }

          <!-- Galleries Grid -->
          @else {
            <div class="galleries-grid">
              @for (gallery of galleries(); track gallery.galleryId) {
                <div class="gallery-card" (click)="openGallery(gallery.galleryId)">
                  <div class="gallery-thumbnail">
                    @if (gallery.photoCount > 0) {
                      <div class="thumbnail-placeholder">
                        <span class="thumbnail-icon">📷</span>
                      </div>
                    } @else {
                      <div class="thumbnail-empty">
                        <span class="thumbnail-icon">+</span>
                        <span class="thumbnail-text">Add Photos</span>
                      </div>
                    }
                  </div>

                  <div class="gallery-info">
                    <h3 class="gallery-name">{{ gallery.name }}</h3>
                    @if (gallery.description) {
                      <p class="gallery-description">{{ gallery.description }}</p>
                    }

                    <div class="gallery-meta">
                      <div class="meta-item">
                        <span class="meta-icon">📷</span>
                        <span>{{ gallery.photoCount }} photos</span>
                      </div>
                      <div class="meta-item">
                        <span class="meta-icon">👁</span>
                        <span>{{ gallery.clientAccessCount }} views</span>
                      </div>
                    </div>

                    <div class="gallery-status">
                      @if (isExpired(gallery)) {
                        <span class="status-badge status-expired">Expired</span>
                      } @else if (gallery.expiresAt) {
                        <span class="status-badge status-expires">
                          Expires {{ formatDate(gallery.expiresAt) }}
                        </span>
                      } @else {
                        <span class="status-badge status-active">Active</span>
                      }
                    </div>

                    <div class="gallery-url">
                      <span class="url-label">Gallery URL:</span>
                      <code class="url-value">{{ getGalleryUrl(gallery.customUrl) }}</code>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </main>
    </div>
  `,
  styles: [`
    .dashboard {
      min-height: 100vh;
      background: #f5f7fa;
    }

    .header {
      background: white;
      border-bottom: 1px solid #e5e7eb;
      padding: 16px 0;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-left h1 {
      margin: 0;
      font-size: 20px;
      color: #1a1a1a;
    }

    .user-email {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: #666;
    }

    .main {
      padding: 40px 0;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }

    .page-header h2 {
      margin: 0;
      font-size: 28px;
      color: #1a1a1a;
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

    .btn-ghost {
      background: transparent;
      color: #666;
    }

    .btn-ghost:hover {
      background: #f5f7fa;
      color: #1a1a1a;
    }

    .btn-icon {
      font-size: 18px;
    }

    .loading-container {
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

    .empty-state {
      text-align: center;
      padding: 80px 20px;
    }

    .empty-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    .empty-state h3 {
      margin: 0 0 8px 0;
      font-size: 20px;
      color: #1a1a1a;
    }

    .empty-state p {
      margin: 0 0 24px 0;
      color: #666;
    }

    .galleries-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }

    .gallery-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid #e5e7eb;
    }

    .gallery-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .gallery-thumbnail {
      aspect-ratio: 16 / 9;
      background: #f5f7fa;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .thumbnail-placeholder,
    .thumbnail-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .thumbnail-icon {
      font-size: 48px;
      opacity: 0.3;
    }

    .thumbnail-text {
      font-size: 14px;
      color: #666;
      opacity: 0.7;
    }

    .gallery-info {
      padding: 20px;
    }

    .gallery-name {
      margin: 0 0 8px 0;
      font-size: 18px;
      color: #1a1a1a;
    }

    .gallery-description {
      margin: 0 0 16px 0;
      font-size: 14px;
      color: #666;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .gallery-meta {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #666;
    }

    .meta-icon {
      font-size: 14px;
    }

    .gallery-status {
      margin-bottom: 12px;
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

    .gallery-url {
      background: #f5f7fa;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
    }

    .url-label {
      color: #666;
      margin-right: 8px;
    }

    .url-value {
      color: #667eea;
      font-family: 'Monaco', 'Courier New', monospace;
    }

    @media (max-width: 768px) {
      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }

      .galleries-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
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
        this.galleries.set(response.galleries);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load galleries:', err);
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

    // Reset both dates to start of day for accurate day comparison
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
