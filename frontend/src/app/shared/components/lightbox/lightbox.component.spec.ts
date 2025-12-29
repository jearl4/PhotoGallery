import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LightboxComponent } from './lightbox.component';
import { Photo } from '../../../core/models/gallery.model';

describe('LightboxComponent', () => {
  let component: LightboxComponent;
  let fixture: ComponentFixture<LightboxComponent>;

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
    },
    {
      photoId: 'photo_3',
      galleryId: 'gal_1',
      fileName: 'test3.jpg',
      originalUrl: 'https://example.com/original/test3.jpg',
      optimizedUrl: 'https://example.com/optimized/test3.jpg',
      thumbnailUrl: 'https://example.com/thumb/test3.jpg',
      uploadedAt: '2025-01-03T00:00:00Z'
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LightboxComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LightboxComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with first photo', () => {
    component.photos = signal(mockPhotos);
    component.initialIndex = signal(0);
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    expect(component.currentIndex()).toBe(0);
    expect(component.currentPhoto()).toEqual(mockPhotos[0]);
  });

  it('should initialize with specified index', () => {
    component.photos = signal(mockPhotos);
    component.initialIndex = signal(1);
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.currentIndex()).toBe(1);
    expect(component.currentPhoto()).toEqual(mockPhotos[1]);
  });

  it('should prevent body scroll on open', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should restore body scroll on destroy', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();
    component.ngOnDestroy();

    expect(document.body.style.overflow).toBe('');
  });

  it('should display lightbox overlay when open', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const overlay = compiled.querySelector('.lightbox-overlay');
    expect(overlay).toBeTruthy();
  });

  it('should display current photo', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const img = compiled.querySelector('.lightbox-image') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://example.com/optimized/test1.jpg');
    expect(img.alt).toBe('test1.jpg');
  });

  it('should close lightbox and emit closed event', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();
    fixture.detectChanges();

    spyOn(component.closed, 'emit');

    component.close();

    expect(component.isOpen()).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(component.closed.emit).toHaveBeenCalled();
  });

  it('should close when overlay is clicked', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();
    fixture.detectChanges();

    spyOn(component, 'close');

    const compiled = fixture.nativeElement as HTMLElement;
    const overlay = compiled.querySelector('.lightbox-overlay') as HTMLElement;

    // Simulate clicking directly on overlay (not a child)
    const event = new MouseEvent('click');
    Object.defineProperty(event, 'target', { value: overlay, enumerable: true });
    Object.defineProperty(event, 'currentTarget', { value: overlay, enumerable: true });
    overlay.dispatchEvent(event);

    expect(component.close).toHaveBeenCalled();
  });

  it('should navigate to next photo', () => {
    component.photos = signal(mockPhotos);
    component.initialIndex = signal(0);
    component.ngOnInit();

    component.next();

    expect(component.currentIndex()).toBe(1);
    expect(component.currentPhoto()).toEqual(mockPhotos[1]);
  });

  it('should navigate to previous photo', () => {
    component.photos = signal(mockPhotos);
    component.initialIndex = signal(1);
    component.ngOnInit();

    component.previous();

    expect(component.currentIndex()).toBe(0);
    expect(component.currentPhoto()).toEqual(mockPhotos[0]);
  });

  it('should not navigate beyond first photo', () => {
    component.photos = signal(mockPhotos);
    component.initialIndex = signal(0);
    component.ngOnInit();

    component.previous();

    expect(component.currentIndex()).toBe(0);
  });

  it('should not navigate beyond last photo', () => {
    component.photos = signal(mockPhotos);
    component.initialIndex = signal(2);
    component.ngOnInit();

    component.next();

    expect(component.currentIndex()).toBe(2);
  });

  it('should handle keyboard navigation - ArrowRight', () => {
    component.photos = signal(mockPhotos);
    component.initialIndex = signal(0);
    component.ngOnInit();

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    component.handleKeyboardEvent(event);

    expect(component.currentIndex()).toBe(1);
  });

  it('should handle keyboard navigation - ArrowLeft', () => {
    component.photos = signal(mockPhotos);
    component.initialIndex = signal(1);
    component.ngOnInit();

    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    component.handleKeyboardEvent(event);

    expect(component.currentIndex()).toBe(0);
  });

  it('should handle keyboard navigation - Escape', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();

    spyOn(component, 'close');

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    component.handleKeyboardEvent(event);

    expect(component.close).toHaveBeenCalled();
  });

  it('should toggle zoom state', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();

    expect(component.isZoomed()).toBe(false);

    const event = new Event('click');
    spyOn(event, 'stopPropagation');
    component.toggleZoom(event);

    expect(component.isZoomed()).toBe(true);
    expect(event.stopPropagation).toHaveBeenCalled();

    component.toggleZoom(event);
    expect(component.isZoomed()).toBe(false);
  });

  it('should emit favoriteToggled event', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();
    fixture.detectChanges();

    spyOn(component.favoriteToggled, 'emit');

    const event = new Event('click');
    component.toggleFavorite(event);

    expect(component.favoriteToggled.emit).toHaveBeenCalledWith(mockPhotos[0]);
  });

  it('should emit downloadRequested event', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();
    fixture.detectChanges();

    spyOn(component.downloadRequested, 'emit');

    const event = new Event('click');
    component.download(event);

    expect(component.downloadRequested.emit).toHaveBeenCalledWith(mockPhotos[0]);
  });

  it('should check if current photo is favorite', () => {
    component.photos = signal(mockPhotos);
    component.favorites = signal(new Set(['photo_1']));
    component.initialIndex = signal(0);
    component.ngOnInit();

    expect(component.isFavorite()).toBe(true);

    component.next();
    expect(component.isFavorite()).toBe(false);
  });

  it('should show navigation buttons when multiple photos', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.prev-btn')).toBeTruthy();
    expect(compiled.querySelector('.next-btn')).toBeTruthy();
  });

  it('should not show navigation buttons when single photo', () => {
    component.photos = signal([mockPhotos[0]]);
    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.prev-btn')).toBeFalsy();
    expect(compiled.querySelector('.next-btn')).toBeFalsy();
  });

  it('should disable prev button on first photo', () => {
    component.photos = signal(mockPhotos);
    component.initialIndex = signal(0);
    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const prevBtn = compiled.querySelector('.prev-btn') as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);
  });

  it('should disable next button on last photo', () => {
    component.photos = signal(mockPhotos);
    component.initialIndex = signal(2);
    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const nextBtn = compiled.querySelector('.next-btn') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
  });

  it('should show info bar when enabled', () => {
    component.photos = signal(mockPhotos);
    component.showInfo = signal(true);
    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.lightbox-info')).toBeTruthy();
  });

  it('should hide info bar when disabled', () => {
    component.photos = signal(mockPhotos);
    component.showInfo = signal(false);
    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.lightbox-info')).toBeFalsy();
  });

  it('should show download button when enabled', () => {
    component.photos = signal(mockPhotos);
    component.showInfo = signal(true);
    component.showDownload = signal(true);
    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const downloadBtn = compiled.querySelector('.info-btn[title="Download"]');
    expect(downloadBtn).toBeTruthy();
  });

  it('should show favorite button when enabled', () => {
    component.photos = signal(mockPhotos);
    component.showInfo = signal(true);
    component.showFavorite = signal(true);
    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const favoriteBtn = Array.from(compiled.querySelectorAll('.info-btn')).find(
      btn => btn.getAttribute('title')?.includes('favorites')
    );
    expect(favoriteBtn).toBeTruthy();
  });

  it('should display photo count when multiple photos', () => {
    component.photos = signal(mockPhotos);
    component.showInfo = signal(true);
    component.initialIndex = signal(1);
    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const photoCount = compiled.querySelector('.photo-count');
    expect(photoCount?.textContent).toContain('2 / 3');
  });

  it('should display photo metadata', () => {
    component.photos = signal(mockPhotos);
    component.showInfo = signal(true);
    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const photoDetails = compiled.querySelector('.photo-details');
    expect(photoDetails?.textContent).toContain('1920 × 1080');
    expect(photoDetails?.textContent).toContain('2.0 MB');
  });

  it('should show loading spinner initially', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.isLoading()).toBe(true);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.loading-spinner')).toBeTruthy();
  });

  it('should hide loading spinner after image loads', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();

    component.onImageLoad();

    expect(component.isLoading()).toBe(false);
    expect(component.hasError()).toBe(false);
  });

  it('should show error message on image load failure', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();

    component.onImageError();

    expect(component.isLoading()).toBe(false);
    expect(component.hasError()).toBe(true);
  });

  it('should reset zoom when changing photos', () => {
    component.photos = signal(mockPhotos);
    component.ngOnInit();

    const event = new Event('click');
    component.toggleZoom(event);
    expect(component.isZoomed()).toBe(true);

    component.next();
    expect(component.isZoomed()).toBe(false);
  });

  it('should get optimized URL when available', () => {
    component.photos = signal([mockPhotos[0]]);
    component.ngOnInit();

    expect(component.getImageUrl()).toBe('https://example.com/optimized/test1.jpg');
  });

  it('should fallback to original URL when optimized not available', () => {
    const photoWithoutOptimized: Photo = {
      ...mockPhotos[0],
      optimizedUrl: undefined
    };
    component.photos = signal([photoWithoutOptimized]);
    component.ngOnInit();

    expect(component.getImageUrl()).toBe('https://example.com/original/test1.jpg');
  });

  it('should format file sizes correctly', () => {
    expect(component.formatFileSize(500)).toBe('500 B');
    expect(component.formatFileSize(1024)).toBe('1.0 KB');
    expect(component.formatFileSize(2097152)).toBe('2.0 MB');
  });
});
