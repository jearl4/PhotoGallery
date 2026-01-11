import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { FormattingService } from '../../../core/services/formatting.service';
import { PhotoUrlService } from '../../../core/services/photo-url.service';
import {
  DashboardSummary,
  GalleryAnalytics,
  TopPhoto,
  ClientBehaviorAnalytics
} from '../../../core/models/analytics.model';
import { HeaderComponent } from '../../../shared/components/header/header.component';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss'
})
export class AnalyticsComponent implements OnInit {
  private analyticsService = inject(AnalyticsService);
  private formattingService = inject(FormattingService);
  private photoUrlService = inject(PhotoUrlService);

  // Data signals
  summary = signal<DashboardSummary | null>(null);
  galleries = signal<GalleryAnalytics[]>([]);
  topPhotos = signal<TopPhoto[]>([]);
  clientBehavior = signal<ClientBehaviorAnalytics | null>(null);

  // Loading states
  isLoadingSummary = signal(true);
  isLoadingGalleries = signal(true);
  isLoadingPhotos = signal(true);
  isLoadingClients = signal(true);

  // Sort state
  gallerySortBy = signal<'views' | 'downloads' | 'favorites' | 'clients'>('views');
  photoMetric = signal<'favorites' | 'downloads'>('favorites');

  // Computed values
  storageFormatted = computed(() => {
    const bytes = this.summary()?.totalStorageBytes ?? 0;
    return this.formattingService.formatFileSize(bytes);
  });

  ngOnInit(): void {
    this.loadAllData();
  }

  loadAllData(): void {
    this.loadSummary();
    this.loadGalleries();
    this.loadTopPhotos();
    this.loadClientBehavior();
  }

  loadSummary(): void {
    this.isLoadingSummary.set(true);
    this.analyticsService.getDashboardSummary().subscribe({
      next: (data) => {
        this.summary.set(data);
        this.isLoadingSummary.set(false);
      },
      error: (err) => {
        console.error('Failed to load summary:', err);
        this.isLoadingSummary.set(false);
      }
    });
  }

  loadGalleries(sortBy: 'views' | 'downloads' | 'favorites' | 'clients' = 'views'): void {
    this.gallerySortBy.set(sortBy);
    this.isLoadingGalleries.set(true);
    this.analyticsService.getGalleriesAnalytics(10, sortBy).subscribe({
      next: (response) => {
        this.galleries.set(response.galleries ?? []);
        this.isLoadingGalleries.set(false);
      },
      error: (err) => {
        console.error('Failed to load galleries:', err);
        this.galleries.set([]);
        this.isLoadingGalleries.set(false);
      }
    });
  }

  loadTopPhotos(metric: 'favorites' | 'downloads' = 'favorites'): void {
    this.photoMetric.set(metric);
    this.isLoadingPhotos.set(true);
    this.analyticsService.getTopPhotos(10, metric).subscribe({
      next: (response) => {
        this.topPhotos.set(response.photos ?? []);
        this.isLoadingPhotos.set(false);
      },
      error: (err) => {
        console.error('Failed to load top photos:', err);
        this.topPhotos.set([]);
        this.isLoadingPhotos.set(false);
      }
    });
  }

  loadClientBehavior(): void {
    this.isLoadingClients.set(true);
    this.analyticsService.getClientBehavior().subscribe({
      next: (data) => {
        this.clientBehavior.set(data);
        this.isLoadingClients.set(false);
      },
      error: (err) => {
        console.error('Failed to load client behavior:', err);
        this.isLoadingClients.set(false);
      }
    });
  }

  formatNumber(value: number): string {
    return this.formattingService.formatNumber(value);
  }

  formatFileSize(bytes: number): string {
    return this.formattingService.formatFileSize(bytes);
  }

  formatTimestamp(dateString: string | undefined): string {
    return this.formattingService.formatTimestamp(dateString);
  }

  getThumbnailUrl(thumbnailKey: string): string {
    return this.photoUrlService.getUrlFromKey(thumbnailKey);
  }

  getDeviceTotal(): number {
    const devices = this.clientBehavior()?.devices;
    if (!devices) return 0;
    return devices.mobile + devices.tablet + devices.desktop;
  }

  getDevicePercentage(type: 'mobile' | 'tablet' | 'desktop'): number {
    const devices = this.clientBehavior()?.devices;
    if (!devices) return 0;
    const total = this.getDeviceTotal();
    if (total === 0) return 0;
    return Math.round((devices[type] / total) * 100);
  }
}
