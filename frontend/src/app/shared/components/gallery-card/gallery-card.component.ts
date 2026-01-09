/**
 * GalleryCard Component
 * A reusable card component for displaying gallery information.
 */

import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Gallery } from '../../../core/models/gallery.model';
import { FormattingService } from '../../../core/services/formatting.service';

@Component({
  selector: 'app-gallery-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery-card.component.html',
  styleUrl: './gallery-card.component.scss'
})
export class GalleryCardComponent {
  private formatting = inject(FormattingService);

  @Input() gallery = signal<Gallery | null>(null);
  @Input() showUrl = signal<boolean>(true);
  @Input() baseUrl = signal<string>('');

  @Output() cardClick = new EventEmitter<Gallery>();

  onClick(): void {
    const g = this.gallery();
    if (g) {
      this.cardClick.emit(g);
    }
  }

  isExpired(): boolean {
    const g = this.gallery();
    return g?.expiresAt ? new Date(g.expiresAt) < new Date() : false;
  }

  formatDate(dateString: string | undefined): string {
    return this.formatting.formatRelativeDate(dateString);
  }

  getGalleryUrl(): string {
    const g = this.gallery();
    if (!g) return '';
    const base = this.baseUrl() || window.location.origin;
    return `${base}/gallery/${g.customUrl}`;
  }
}
