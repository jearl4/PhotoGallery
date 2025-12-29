import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PhotoGridComponent } from './photo-grid.component';
import { Photo } from '../../../core/models/gallery.model';

describe('PhotoGridComponent', () => {
  let component: PhotoGridComponent;
  let fixture: ComponentFixture<PhotoGridComponent>;

  const mockPhotos: Photo[] = [
    {
      photoId: 'photo_1',
      galleryId: 'gal_1',
      fileName: 'test1.jpg',
      originalUrl: 'https://example.com/original/test1.jpg',
      optimizedUrl: 'https://example.com/optimized/test1.jpg',
      thumbnailUrl: 'https://example.com/thumb/test1.jpg',
      uploadedAt: '2025-01-01T00:00:00Z',
      metadata: {
        width: 1920,
        height: 1080,
        size: 2048000,
        contentType: 'image/jpeg'
      }
    },
    {
      photoId: 'photo_2',
      galleryId: 'gal_1',
      fileName: 'test2.jpg',
      originalUrl: 'https://example.com/original/test2.jpg',
      optimizedUrl: 'https://example.com/optimized/test2.jpg',
      thumbnailUrl: 'https://example.com/thumb/test2.jpg',
      uploadedAt: '2025-01-02T00:00:00Z',
      metadata: {
        width: 3840,
        height: 2160,
        size: 4096000,
        contentType: 'image/jpeg'
      }
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhotoGridComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display empty state when no photos', () => {
    component.photos = signal([]);
    component.emptyMessage = signal('No photos available');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const emptyState = compiled.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState?.textContent).toContain('No photos available');
  });

  it('should display photo grid with photos', () => {
    component.photos = signal(mockPhotos);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const photoCards = compiled.querySelectorAll('.photo-card');
    expect(photoCards.length).toBe(2);
  });

  it('should display photo thumbnails with correct URLs', () => {
    component.photos = signal([mockPhotos[0]]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const img = compiled.querySelector('.photo-thumbnail img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://example.com/thumb/test1.jpg');
    expect(img.alt).toBe('test1.jpg');
  });

  it('should emit photoClick event when photo is clicked', () => {
    component.photos = signal([mockPhotos[0]]);
    fixture.detectChanges();

    spyOn(component.photoClick, 'emit');

    const compiled = fixture.nativeElement as HTMLElement;
    const photoCard = compiled.querySelector('.photo-card') as HTMLElement;
    photoCard.click();

    expect(component.photoClick.emit).toHaveBeenCalledWith(mockPhotos[0]);
  });

  it('should show favorite button when config enabled', () => {
    component.photos = signal([mockPhotos[0]]);
    component.config = signal({ showFavoriteButton: true });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const favoriteBtn = compiled.querySelector('.favorite-btn');
    expect(favoriteBtn).toBeTruthy();
  });

  it('should emit favoriteClick event and stop propagation', () => {
    component.photos = signal([mockPhotos[0]]);
    component.config = signal({ showFavoriteButton: true });
    fixture.detectChanges();

    spyOn(component.favoriteClick, 'emit');
    spyOn(component.photoClick, 'emit');

    const compiled = fixture.nativeElement as HTMLElement;
    const favoriteBtn = compiled.querySelector('.favorite-btn') as HTMLElement;
    favoriteBtn.click();

    expect(component.favoriteClick.emit).toHaveBeenCalledWith(mockPhotos[0]);
    expect(component.photoClick.emit).not.toHaveBeenCalled();
  });

  it('should show favorited state when photo is in favorites set', () => {
    component.photos = signal([mockPhotos[0]]);
    component.config = signal({ showFavoriteButton: true });
    component.favorites = signal(new Set(['photo_1']));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const favoriteBtn = compiled.querySelector('.favorite-btn') as HTMLElement;
    expect(favoriteBtn.classList.contains('favorited')).toBe(true);
    expect(favoriteBtn.textContent?.trim()).toBe('❤️');
  });

  it('should show delete button when config enabled', () => {
    component.photos = signal([mockPhotos[0]]);
    component.config = signal({ showDeleteButton: true });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const deleteBtn = compiled.querySelector('.delete-btn');
    expect(deleteBtn).toBeTruthy();
  });

  it('should emit deleteClick event and stop propagation', () => {
    component.photos = signal([mockPhotos[0]]);
    component.config = signal({ showDeleteButton: true });
    fixture.detectChanges();

    spyOn(component.deleteClick, 'emit');
    spyOn(component.photoClick, 'emit');

    const compiled = fixture.nativeElement as HTMLElement;
    const deleteBtn = compiled.querySelector('.delete-btn') as HTMLElement;
    deleteBtn.click();

    expect(component.deleteClick.emit).toHaveBeenCalledWith(mockPhotos[0]);
    expect(component.photoClick.emit).not.toHaveBeenCalled();
  });

  it('should show metadata when config enabled', () => {
    component.photos = signal([mockPhotos[0]]);
    component.config = signal({ showMetadata: true });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const metadata = compiled.querySelector('.photo-metadata');
    expect(metadata).toBeTruthy();
    expect(metadata?.textContent).toContain('test1.jpg');
    expect(metadata?.textContent).toContain('1920 × 1080');
  });

  it('should not show metadata when config disabled', () => {
    component.photos = signal([mockPhotos[0]]);
    component.config = signal({ showMetadata: false });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const metadata = compiled.querySelector('.photo-metadata');
    expect(metadata).toBeFalsy();
  });

  it('should format file sizes correctly', () => {
    expect(component.formatFileSize(500)).toBe('500 B');
    expect(component.formatFileSize(1024)).toBe('1.0 KB');
    expect(component.formatFileSize(1536)).toBe('1.5 KB');
    expect(component.formatFileSize(1048576)).toBe('1.0 MB');
    expect(component.formatFileSize(2097152)).toBe('2.0 MB');
  });

  it('should check if photo is favorite', () => {
    component.favorites = signal(new Set(['photo_1', 'photo_3']));
    expect(component.isFavorite('photo_1')).toBe(true);
    expect(component.isFavorite('photo_2')).toBe(false);
    expect(component.isFavorite('photo_3')).toBe(true);
  });

  it('should get thumbnail URL with fallback', () => {
    const photoWithThumb: Photo = { ...mockPhotos[0] };
    expect(component.getThumbnailUrl(photoWithThumb)).toBe('https://example.com/thumb/test1.jpg');

    const photoWithoutThumb: Photo = { ...mockPhotos[0], thumbnailUrl: undefined };
    expect(component.getThumbnailUrl(photoWithoutThumb)).toBe('https://example.com/optimized/test1.jpg');

    const photoWithoutOptimized: Photo = { ...photoWithoutThumb, optimizedUrl: undefined };
    expect(component.getThumbnailUrl(photoWithoutOptimized)).toBe('https://example.com/original/test1.jpg');
  });

  it('should handle image error by setting fallback', () => {
    const mockEvent = {
      target: document.createElement('img')
    } as Event;

    component.onImageError(mockEvent);

    const img = mockEvent.target as HTMLImageElement;
    expect(img.src).toContain('data:image/svg+xml');
  });

  it('should apply custom column count from config', () => {
    component.config = signal({ columns: 4 });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const grid = compiled.querySelector('.photo-grid') as HTMLElement;
    expect(grid.style.getPropertyValue('--columns')).toBe('4');
  });

  it('should use default column count when not specified', () => {
    component.config = signal({});
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const grid = compiled.querySelector('.photo-grid') as HTMLElement;
    expect(grid.style.getPropertyValue('--columns')).toBe('3');
  });
});
