import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface PhotographerInfo {
  name: string;
}

interface GalleryInfo {
  galleryId: string;
  name: string;
  description: string;
  customUrl: string;
  photoCount: number;
}

interface PortalInfoResponse {
  photographer: PhotographerInfo;
  galleries: GalleryInfo[];
}

@Component({
  selector: 'app-photographer-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="portal-container">
      @if (loading()) {
        <div class="loading">Loading...</div>
      } @else if (error()) {
        <div class="error">
          <h2>Oops!</h2>
          <p>{{ error() }}</p>
        </div>
      } @else {
        <header class="portal-header">
          <h1>{{ photographer()?.name }}</h1>
          <p class="tagline">Photography Portfolio</p>
        </header>

        <main class="galleries-section">
          @if (galleries().length === 0) {
            <p class="no-galleries">No galleries available yet.</p>
          } @else {
            <div class="galleries-grid">
              @for (gallery of galleries(); track gallery.galleryId) {
                <a [routerLink]="['/portal', gallery.customUrl]" class="gallery-card">
                  <div class="gallery-info">
                    <h3>{{ gallery.name }}</h3>
                    @if (gallery.description) {
                      <p class="description">{{ gallery.description }}</p>
                    }
                    <span class="photo-count">{{ gallery.photoCount }} photos</span>
                  </div>
                </a>
              }
            </div>
          }
        </main>
      }
    </div>
  `,
  styles: [`
    .portal-container {
      min-height: 100vh;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 50vh;
      font-size: 1.2rem;
      color: #666;
    }

    .error {
      text-align: center;
      padding: 3rem;
      color: #dc3545;
    }

    .portal-header {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid #eee;
    }

    .portal-header h1 {
      font-size: 2.5rem;
      margin: 0 0 0.5rem 0;
      color: #333;
    }

    .tagline {
      color: #666;
      font-size: 1.1rem;
      margin: 0;
    }

    .galleries-section {
      padding: 1rem 0;
    }

    .no-galleries {
      text-align: center;
      color: #666;
      font-size: 1.1rem;
    }

    .galleries-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .gallery-card {
      display: block;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
      text-decoration: none;
      color: inherit;
      transition: box-shadow 0.2s, transform 0.2s;
    }

    .gallery-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    .gallery-info h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      color: #333;
    }

    .description {
      color: #666;
      font-size: 0.9rem;
      margin: 0 0 1rem 0;
      line-height: 1.5;
    }

    .photo-count {
      display: inline-block;
      background: #f5f5f5;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
      color: #666;
    }
  `]
})
export class PhotographerHomeComponent implements OnInit {
  private http = inject(HttpClient);

  photographer = signal<PhotographerInfo | null>(null);
  galleries = signal<GalleryInfo[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.loadPortalInfo();
  }

  private loadPortalInfo() {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<PortalInfoResponse>(`${environment.apiUrl}/portal/info`)
      .subscribe({
        next: (response) => {
          this.photographer.set(response.photographer);
          this.galleries.set(response.galleries || []);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load portal info:', err);
          this.error.set('Unable to load photographer information. Please try again later.');
          this.loading.set(false);
        }
      });
  }
}
