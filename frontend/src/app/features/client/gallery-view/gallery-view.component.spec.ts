import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { GalleryViewComponent } from './gallery-view.component';
import { ClientSessionService } from '../../../core/services/client-session.service';
import { ApiService } from '../../../core/services/api.service';
import { Gallery } from '../../../core/models/gallery.model';
import { Photo } from '../../../core/models/photo.model';

describe('GalleryViewComponent', () => {
  let component: GalleryViewComponent;
  let fixture: ComponentFixture<GalleryViewComponent>;
  let mockSessionService: jasmine.SpyObj<ClientSessionService>;
  let mockApiService: jasmine.SpyObj<ApiService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockActivatedRoute: any;

  const mockGallery: Gallery = {
    galleryId: 'gal_123',
    photographerId: 'user_123',
    name: 'Test Gallery',
    description: 'Test Description',
    customUrl: 'test-gallery',
    password: 'hashed',
    createdAt: '2024-01-01T00:00:00Z',
    status: 'active',
    photoCount: 3,
    totalSize: 1024000,
    clientAccessCount: 5
  };

  const mockPhotos: Photo[] = [
    {
      photoId: 'photo_1',
      galleryId: 'gal_123',
      fileName: 'photo1.jpg',
      originalKey: 'original/photo1.jpg',
      optimizedKey: 'optimized/photo1.jpg',
      thumbnailKey: 'thumbnail/photo1.jpg',
      mimeType: 'image/jpeg',
      size: 102400,
      width: 1920,
      height: 1080,
      uploadedAt: '2024-01-01T00:00:00Z',
      favoriteCount: 2,
      downloadCount: 5
    },
    {
      photoId: 'photo_2',
      galleryId: 'gal_123',
      fileName: 'photo2.jpg',
      originalKey: 'original/photo2.jpg',
      optimizedKey: 'optimized/photo2.jpg',
      thumbnailKey: 'thumbnail/photo2.jpg',
      mimeType: 'image/jpeg',
      size: 204800,
      width: 1920,
      height: 1080,
      uploadedAt: '2024-01-02T00:00:00Z',
      favoriteCount: 1,
      downloadCount: 3
    }
  ];

  beforeEach(async () => {
    mockSessionService = jasmine.createSpyObj('ClientSessionService', [
      'getSessionForGallery',
      'clearSession'
    ]);

    mockApiService = jasmine.createSpyObj('ApiService', [
      'getClientGalleryPhotos',
      'getClientFavorites',
      'toggleFavorite'
    ]);

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: jasmine.createSpy('get').and.returnValue('test-gallery')
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [GalleryViewComponent],
      providers: [
        { provide: ClientSessionService, useValue: mockSessionService },
        { provide: ApiService, useValue: mockApiService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GalleryViewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should redirect if no session exists', () => {
      mockSessionService.getSessionForGallery.and.returnValue(null);

      fixture.detectChanges();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/gallery', 'test-gallery']);
    });

    it('should load gallery from session', () => {
      const mockSession = {
        sessionToken: 'token',
        gallery: mockGallery,
        customUrl: 'test-gallery'
      };
      mockSessionService.getSessionForGallery.and.returnValue(mockSession);
      mockApiService.getClientGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
      mockApiService.getClientFavorites.and.returnValue(of({ favorites: [] }));

      fixture.detectChanges();

      expect(component.gallery()).toEqual(mockGallery);
      expect(component.isLoading()).toBe(false);
    });

    it('should load photos on init', () => {
      const mockSession = {
        sessionToken: 'token',
        gallery: mockGallery,
        customUrl: 'test-gallery'
      };
      mockSessionService.getSessionForGallery.and.returnValue(mockSession);
      mockApiService.getClientGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
      mockApiService.getClientFavorites.and.returnValue(of({ favorites: [] }));

      fixture.detectChanges();

      expect(mockApiService.getClientGalleryPhotos).toHaveBeenCalledWith('test-gallery');
      expect(component.photos()).toEqual(mockPhotos);
    });

    it('should load favorites on init', () => {
      const mockSession = {
        sessionToken: 'token',
        gallery: mockGallery,
        customUrl: 'test-gallery'
      };
      const mockFavorites = [
        { photoId: 'photo_1', favoritedAt: '2024-01-01T00:00:00Z' }
      ];
      mockSessionService.getSessionForGallery.and.returnValue(mockSession);
      mockApiService.getClientGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
      mockApiService.getClientFavorites.and.returnValue(of({ favorites: mockFavorites }));

      fixture.detectChanges();

      expect(mockApiService.getClientFavorites).toHaveBeenCalled();
      expect(component.isFavorite('photo_1')).toBe(true);
      expect(component.isFavorite('photo_2')).toBe(false);
    });
  });

  describe('loadPhotos', () => {
    beforeEach(() => {
      const mockSession = {
        sessionToken: 'token',
        gallery: mockGallery,
        customUrl: 'test-gallery'
      };
      mockSessionService.getSessionForGallery.and.returnValue(mockSession);
      mockApiService.getClientFavorites.and.returnValue(of({ favorites: [] }));
    });

    it('should set loadingPhotos during fetch', () => {
      mockApiService.getClientGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));

      fixture.detectChanges();

      // Loading should be complete after init
      expect(component.loadingPhotos()).toBe(false);
    });

    it('should handle photo loading error', () => {
      mockApiService.getClientGalleryPhotos.and.returnValue(throwError(() => new Error('Failed')));

      fixture.detectChanges();

      expect(component.loadingPhotos()).toBe(false);
      expect(component.photos()).toEqual([]);
    });
  });

  describe('toggleFavorite', () => {
    beforeEach(() => {
      const mockSession = {
        sessionToken: 'token',
        gallery: mockGallery,
        customUrl: 'test-gallery'
      };
      mockSessionService.getSessionForGallery.and.returnValue(mockSession);
      mockApiService.getClientGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
      mockApiService.getClientFavorites.and.returnValue(of({ favorites: [] }));
      fixture.detectChanges();
    });

    it('should add photo to favorites', () => {
      mockApiService.toggleFavorite.and.returnValue(of({ isFavorited: true }));

      const event = new Event('click');
      spyOn(event, 'stopPropagation');

      component.toggleFavorite(mockPhotos[0], event);

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockApiService.toggleFavorite).toHaveBeenCalledWith('photo_1');
      expect(component.isFavorite('photo_1')).toBe(true);
    });

    it('should remove photo from favorites', () => {
      // First add to favorites
      component.favorites.set(new Set(['photo_1']));

      mockApiService.toggleFavorite.and.returnValue(of({ isFavorited: false }));

      const event = new Event('click');
      component.toggleFavorite(mockPhotos[0], event);

      expect(component.isFavorite('photo_1')).toBe(false);
    });

    it('should handle toggle error', () => {
      mockApiService.toggleFavorite.and.returnValue(throwError(() => new Error('Failed')));

      const event = new Event('click');
      component.toggleFavorite(mockPhotos[0], event);

      // Should not crash, favorites unchanged
      expect(component.isFavorite('photo_1')).toBe(false);
    });
  });

  describe('isFavorite', () => {
    beforeEach(() => {
      const mockSession = {
        sessionToken: 'token',
        gallery: mockGallery,
        customUrl: 'test-gallery'
      };
      mockSessionService.getSessionForGallery.and.returnValue(mockSession);
      mockApiService.getClientGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
      mockApiService.getClientFavorites.and.returnValue(of({ favorites: [] }));
      fixture.detectChanges();
    });

    it('should return false for non-favorited photo', () => {
      expect(component.isFavorite('photo_1')).toBe(false);
    });

    it('should return true for favorited photo', () => {
      component.favorites.set(new Set(['photo_1']));
      expect(component.isFavorite('photo_1')).toBe(true);
    });
  });

  describe('favoriteCount', () => {
    beforeEach(() => {
      const mockSession = {
        sessionToken: 'token',
        gallery: mockGallery,
        customUrl: 'test-gallery'
      };
      mockSessionService.getSessionForGallery.and.returnValue(mockSession);
      mockApiService.getClientGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
      mockApiService.getClientFavorites.and.returnValue(of({ favorites: [] }));
      fixture.detectChanges();
    });

    it('should return 0 when no favorites', () => {
      expect(component.favoriteCount()).toBe(0);
    });

    it('should return correct count', () => {
      component.favorites.set(new Set(['photo_1', 'photo_2']));
      expect(component.favoriteCount()).toBe(2);
    });
  });

  describe('view modes', () => {
    beforeEach(() => {
      const mockSession = {
        sessionToken: 'token',
        gallery: mockGallery,
        customUrl: 'test-gallery'
      };
      mockSessionService.getSessionForGallery.and.returnValue(mockSession);
      mockApiService.getClientGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
      mockApiService.getClientFavorites.and.returnValue(of({ favorites: [] }));
      fixture.detectChanges();
    });

    it('should default to all view mode', () => {
      expect(component.viewMode()).toBe('all');
    });

    it('should switch to favorites view mode', () => {
      component.setViewMode('favorites');
      expect(component.viewMode()).toBe('favorites');
    });

    it('should display all photos in all mode', () => {
      component.setViewMode('all');
      expect(component.displayedPhotos()).toEqual(mockPhotos);
    });

    it('should display only favorites in favorites mode', () => {
      component.favorites.set(new Set(['photo_1']));
      component.setViewMode('favorites');

      const displayed = component.displayedPhotos();
      expect(displayed.length).toBe(1);
      expect(displayed[0].photoId).toBe('photo_1');
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      const mockSession = {
        sessionToken: 'token',
        gallery: mockGallery,
        customUrl: 'test-gallery'
      };
      mockSessionService.getSessionForGallery.and.returnValue(mockSession);
      mockApiService.getClientGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
      mockApiService.getClientFavorites.and.returnValue(of({ favorites: [] }));
      fixture.detectChanges();
    });

    it('should clear session and navigate home', () => {
      component.logout();

      expect(mockSessionService.clearSession).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('template integration', () => {
    beforeEach(() => {
      const mockSession = {
        sessionToken: 'token',
        gallery: mockGallery,
        customUrl: 'test-gallery'
      };
      mockSessionService.getSessionForGallery.and.returnValue(mockSession);
      mockApiService.getClientGalleryPhotos.and.returnValue(of({ photos: mockPhotos }));
      mockApiService.getClientFavorites.and.returnValue(of({ favorites: [] }));
      fixture.detectChanges();
    });

    it('should render gallery name', () => {
      const h1 = fixture.nativeElement.querySelector('h1');
      expect(h1.textContent).toContain('Test Gallery');
    });

    it('should render photos grid', () => {
      const grid = fixture.nativeElement.querySelector('.photos-grid');
      expect(grid).toBeTruthy();

      const cards = fixture.nativeElement.querySelectorAll('.photo-card');
      expect(cards.length).toBe(2);
    });

    it('should render filter buttons', () => {
      const buttons = fixture.nativeElement.querySelectorAll('.filter-btn');
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent.trim()).toContain('All Photos');
      expect(buttons[1].textContent.trim()).toContain('Favorites');
    });

    it('should show active class on current view mode', () => {
      const allButton = fixture.nativeElement.querySelectorAll('.filter-btn')[0];
      expect(allButton.classList.contains('active')).toBe(true);
    });
  });
});
