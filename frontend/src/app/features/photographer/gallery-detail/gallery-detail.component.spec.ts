import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { GalleryDetailComponent } from './gallery-detail.component';
import { ApiService } from '../../../core/services/api.service';
import { Gallery, Photo } from '../../../core/models/gallery.model';

describe('GalleryDetailComponent', () => {
  let component: GalleryDetailComponent;
  let fixture: ComponentFixture<GalleryDetailComponent>;
  let mockApiService: jasmine.SpyObj<ApiService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockActivatedRoute: any;

  const mockGallery: Gallery = {
    galleryId: 'gal_123',
    userId: 'user_123',
    name: 'Test Gallery',
    customUrl: 'test-gallery',
    description: 'Test description',
    photoCount: 2,
    clientAccessCount: 10,
    createdAt: '2025-01-01T00:00:00Z',
    status: 'active'
  };

  const mockPhotos: Photo[] = [
    {
      photoId: 'photo_1',
      galleryId: 'gal_123',
      fileName: 'test1.jpg',
      originalUrl: 'https://example.com/original/test1.jpg',
      optimizedUrl: 'https://example.com/optimized/test1.jpg',
      thumbnailUrl: 'https://example.com/thumb/test1.jpg',
      uploadedAt: '2025-01-01T00:00:00Z'
    },
    {
      photoId: 'photo_2',
      galleryId: 'gal_123',
      fileName: 'test2.jpg',
      originalUrl: 'https://example.com/original/test2.jpg',
      optimizedUrl: 'https://example.com/optimized/test2.jpg',
      thumbnailUrl: 'https://example.com/thumb/test2.jpg',
      uploadedAt: '2025-01-02T00:00:00Z'
    }
  ];

  const mockFavorites = [
    { photoId: 'photo_1', sessionId: 'session_1', favoritedAt: '2025-01-01T00:00:00Z' }
  ];

  beforeEach(async () => {
    mockApiService = jasmine.createSpyObj('ApiService', [
      'getGallery',
      'getGalleryPhotos',
      'getGalleryFavorites',
      'deletePhoto',
      'deleteGallery'
    ]);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: jasmine.createSpy('get').and.returnValue('gal_123')
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [GalleryDetailComponent],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GalleryDetailComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load gallery, photos, and favorites on init', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: mockFavorites }));

    fixture.detectChanges();

    setTimeout(() => {
      expect(mockApiService.getGallery).toHaveBeenCalledWith('gal_123');
      expect(mockApiService.getGalleryPhotos).toHaveBeenCalledWith('gal_123');
      expect(mockApiService.getGalleryFavorites).toHaveBeenCalledWith('gal_123');
      expect(component.gallery()).toEqual(mockGallery);
      expect(component.photos()).toEqual(mockPhotos);
      expect(component.favorites()).toEqual(mockFavorites);
      expect(component.isLoading()).toBe(false);
      done();
    }, 100);
  });

  it('should display loading state', () => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: [] }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    component.isLoading.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.loading-container')).toBeTruthy();
  });

  it('should display gallery name and description', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: [] }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    fixture.detectChanges();

    setTimeout(() => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const galleryName = compiled.querySelector('.gallery-name');
      expect(galleryName?.textContent).toContain('Test Gallery');

      const description = compiled.querySelector('.gallery-description');
      expect(description?.textContent).toContain('Test description');
      done();
    }, 100);
  });

  it('should display gallery statistics', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: mockFavorites }));

    fixture.detectChanges();

    setTimeout(() => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const stats = compiled.querySelectorAll('.stat-value');

      expect(stats[0]?.textContent?.trim()).toBe('2');  // Photo count
      expect(stats[1]?.textContent?.trim()).toBe('10'); // Views
      expect(stats[2]?.textContent?.trim()).toBe('1');  // Favorites
      done();
    }, 100);
  });

  it('should copy gallery URL to clipboard', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: [] }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    // Mock clipboard API
    const mockClipboard = {
      writeText: jasmine.createSpy('writeText').and.returnValue(Promise.resolve())
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true
    });

    fixture.detectChanges();

    setTimeout(() => {
      component.copyUrl();

      setTimeout(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
          jasmine.stringContaining('/gallery/test-gallery')
        );
        expect(component.urlCopied()).toBe(true);
        done();
      }, 100);
    }, 100);
  });

  it('should reset urlCopied after 2 seconds', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: [] }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    const mockClipboard = {
      writeText: jasmine.createSpy('writeText').and.returnValue(Promise.resolve())
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true
    });

    fixture.detectChanges();

    setTimeout(() => {
      component.copyUrl();

      setTimeout(() => {
        expect(component.urlCopied()).toBe(false);
        done();
      }, 2100);
    }, 100);
  });

  it('should navigate to edit gallery', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: [] }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    fixture.detectChanges();

    setTimeout(() => {
      component.editGallery();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/galleries', 'gal_123', 'edit']);
      done();
    }, 100);
  });

  it('should navigate to upload photos', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: [] }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    fixture.detectChanges();

    setTimeout(() => {
      component.uploadPhotos();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/galleries', 'gal_123', 'upload']);
      done();
    }, 100);
  });

  it('should navigate back to dashboard', () => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: [] }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    fixture.detectChanges();

    component.goBack();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/dashboard']);
  });

  it('should delete photo after confirmation', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));
    mockApiService.deletePhoto.and.returnValue(of(void 0));

    spyOn(window, 'confirm').and.returnValue(true);

    fixture.detectChanges();

    setTimeout(() => {
      const initialPhotoCount = component.photos().length;
      const initialGalleryCount = component.gallery()!.photoCount;

      component.deletePhoto(mockPhotos[0]);

      setTimeout(() => {
        expect(window.confirm).toHaveBeenCalled();
        expect(mockApiService.deletePhoto).toHaveBeenCalledWith('gal_123', 'photo_1');
        expect(component.photos().length).toBe(initialPhotoCount - 1);
        expect(component.gallery()!.photoCount).toBe(initialGalleryCount - 1);
        done();
      }, 100);
    }, 100);
  });

  it('should not delete photo if not confirmed', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    spyOn(window, 'confirm').and.returnValue(false);

    fixture.detectChanges();

    setTimeout(() => {
      component.deletePhoto(mockPhotos[0]);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockApiService.deletePhoto).not.toHaveBeenCalled();
      done();
    }, 100);
  });

  it('should delete gallery after confirmation', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: [] }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));
    mockApiService.deleteGallery.and.returnValue(of(void 0));

    spyOn(window, 'confirm').and.returnValue(true);

    fixture.detectChanges();

    setTimeout(() => {
      component.deleteGallery();

      setTimeout(() => {
        expect(window.confirm).toHaveBeenCalled();
        expect(mockApiService.deleteGallery).toHaveBeenCalledWith('gal_123');
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/dashboard']);
        done();
      }, 100);
    }, 100);
  });

  it('should not delete gallery if not confirmed', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: [] }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    spyOn(window, 'confirm').and.returnValue(false);

    fixture.detectChanges();

    setTimeout(() => {
      component.deleteGallery();

      expect(window.confirm).toHaveBeenCalled();
      expect(mockApiService.deleteGallery).not.toHaveBeenCalled();
      done();
    }, 100);
  });

  it('should generate correct gallery URL', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: [] }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    fixture.detectChanges();

    setTimeout(() => {
      const url = component.getGalleryUrl();
      expect(url).toContain('/gallery/test-gallery');
      expect(url).toContain(window.location.origin);
      done();
    }, 100);
  });

  it('should handle error when loading gallery', () => {
    const consoleSpy = spyOn(console, 'error');
    mockApiService.getGallery.and.returnValue(
      throwError(() => new Error('Failed to load'))
    );
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: [] }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    fixture.detectChanges();

    expect(consoleSpy).toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
  });

  it('should handle error when loading photos', () => {
    const consoleSpy = spyOn(console, 'error');
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(
      throwError(() => new Error('Failed to load photos'))
    );
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    fixture.detectChanges();

    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should navigate to dashboard if no gallery ID', () => {
    mockActivatedRoute.snapshot.paramMap.get.and.returnValue(null);

    fixture.detectChanges();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/dashboard']);
  });

  it('should display photos in grid', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    fixture.detectChanges();

    setTimeout(() => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const photoCards = compiled.querySelectorAll('.photo-card');
      expect(photoCards.length).toBe(2);
      done();
    }, 100);
  });

  it('should display empty state when no photos', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getGalleryPhotos.and.returnValue(of({ photos: [] }));
    mockApiService.getGalleryFavorites.and.returnValue(of({ favorites: [] }));

    fixture.detectChanges();

    setTimeout(() => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const emptyState = compiled.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState?.textContent).toContain('No photos yet');
      done();
    }, 100);
  });
});
