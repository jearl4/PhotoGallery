import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { Gallery } from '../../../core/models/gallery.model';
import { User } from '../../../core/models/user.model';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockApiService: jasmine.SpyObj<ApiService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const mockUser: User = {
    userId: 'user_123',
    email: 'photographer@example.com',
    name: 'Test Photographer',
    provider: 'google'
  };

  const mockGalleries: Gallery[] = [
    {
      galleryId: 'gal_1',
      userId: 'user_123',
      name: 'Wedding Gallery',
      customUrl: 'wedding-2025',
      description: 'Beautiful wedding photos',
      photoCount: 50,
      clientAccessCount: 25,
      createdAt: '2025-01-01T00:00:00Z',
      status: 'active'
    },
    {
      galleryId: 'gal_2',
      userId: 'user_123',
      name: 'Portrait Session',
      customUrl: 'portraits-jan',
      description: 'Family portraits',
      photoCount: 0,
      clientAccessCount: 0,
      createdAt: '2025-01-15T00:00:00Z',
      status: 'active',
      expiresAt: '2025-02-15T00:00:00Z'
    }
  ];

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj('AuthService', ['logout'], {
      currentUser$: of(mockUser)
    });
    mockApiService = jasmine.createSpyObj('ApiService', ['getGalleries']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ApiService, useValue: mockApiService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load galleries on init', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: mockGalleries }));

    fixture.detectChanges();

    expect(mockApiService.getGalleries).toHaveBeenCalled();
    expect(component.galleries()).toEqual(mockGalleries);
    expect(component.isLoading()).toBe(false);
  });

  it('should display loading state', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: [] }));
    component.isLoading.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const loadingContainer = compiled.querySelector('.loading-container');
    expect(loadingContainer).toBeTruthy();
    expect(loadingContainer?.textContent).toContain('Loading galleries...');
  });

  it('should display empty state when no galleries', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: [] }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const emptyState = compiled.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState?.textContent).toContain('No galleries yet');
  });

  it('should display galleries in grid', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: mockGalleries }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const galleryCards = compiled.querySelectorAll('.gallery-card');
    expect(galleryCards.length).toBe(2);
  });

  it('should display gallery information correctly', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: [mockGalleries[0]] }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const galleryName = compiled.querySelector('.gallery-name');
    expect(galleryName?.textContent).toContain('Wedding Gallery');

    const galleryDescription = compiled.querySelector('.gallery-description');
    expect(galleryDescription?.textContent).toContain('Beautiful wedding photos');
  });

  it('should display photo count', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: [mockGalleries[0]] }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const metaItems = compiled.querySelectorAll('.meta-item');
    const photoCount = Array.from(metaItems).find(item =>
      item.textContent?.includes('photos')
    );
    expect(photoCount?.textContent).toContain('50 photos');
  });

  it('should display client access count', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: [mockGalleries[0]] }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const metaItems = compiled.querySelectorAll('.meta-item');
    const viewCount = Array.from(metaItems).find(item =>
      item.textContent?.includes('views')
    );
    expect(viewCount?.textContent).toContain('25 views');
  });

  it('should navigate to create gallery', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: [] }));
    fixture.detectChanges();

    component.createGallery();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/galleries/new']);
  });

  it('should navigate to gallery detail when clicked', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: mockGalleries }));
    fixture.detectChanges();

    component.openGallery('gal_1');

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/galleries', 'gal_1']);
  });

  it('should call logout when sign out is clicked', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: [] }));
    fixture.detectChanges();

    component.logout();

    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('should display user email in header', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: [] }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const userEmail = compiled.querySelector('.user-email');
    expect(userEmail?.textContent).toBe('photographer@example.com');
  });

  it('should check if gallery is expired', () => {
    const expiredGallery: Gallery = {
      ...mockGalleries[0],
      expiresAt: '2020-01-01T00:00:00Z'
    };

    expect(component.isExpired(expiredGallery)).toBe(true);
    expect(component.isExpired(mockGalleries[0])).toBe(false);
  });

  it('should format date correctly', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    expect(component.formatDate(tomorrow.toISOString())).toBe('tomorrow');

    const today = new Date();
    expect(component.formatDate(today.toISOString())).toBe('today');

    const threeDays = new Date();
    threeDays.setDate(threeDays.getDate() + 3);
    expect(component.formatDate(threeDays.toISOString())).toBe('in 3 days');
  });

  it('should generate correct gallery URL', () => {
    const url = component.getGalleryUrl('test-gallery');
    expect(url).toContain('/gallery/test-gallery');
    expect(url).toContain(window.location.origin);
  });

  it('should display active status badge', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: [mockGalleries[0]] }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const statusBadge = compiled.querySelector('.status-active');
    expect(statusBadge).toBeTruthy();
    expect(statusBadge?.textContent).toBe('Active');
  });

  it('should display expired status badge', () => {
    const expiredGallery: Gallery = {
      ...mockGalleries[0],
      expiresAt: '2020-01-01T00:00:00Z'
    };
    mockApiService.getGalleries.and.returnValue(of({ galleries: [expiredGallery] }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const statusBadge = compiled.querySelector('.status-expired');
    expect(statusBadge).toBeTruthy();
  });

  it('should display expires status badge with date', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: [mockGalleries[1]] }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const statusBadge = compiled.querySelector('.status-expires');
    expect(statusBadge).toBeTruthy();
    expect(statusBadge?.textContent).toContain('Expires');
  });

  it('should display gallery URL', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: [mockGalleries[0]] }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const urlValue = compiled.querySelector('.url-value');
    expect(urlValue?.textContent).toContain('/gallery/wedding-2025');
  });

  it('should handle error when loading galleries', () => {
    const consoleSpy = spyOn(console, 'error');
    mockApiService.getGalleries.and.returnValue(
      throwError(() => new Error('Failed to load'))
    );

    fixture.detectChanges();

    expect(consoleSpy).toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
    expect(component.galleries()).toEqual([]);
  });

  it('should display create button in header', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: mockGalleries }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const createBtn = compiled.querySelector('.page-header .btn-primary');
    expect(createBtn).toBeTruthy();
    expect(createBtn?.textContent).toContain('New Gallery');
  });

  it('should display create button in empty state', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: [] }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const createBtn = compiled.querySelector('.empty-state .btn-primary');
    expect(createBtn).toBeTruthy();
    expect(createBtn?.textContent).toContain('Create Gallery');
  });

  it('should show different thumbnail states based on photo count', () => {
    mockApiService.getGalleries.and.returnValue(of({ galleries: mockGalleries }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const galleryCards = compiled.querySelectorAll('.gallery-card');

    // First gallery has photos
    const firstThumbnail = galleryCards[0].querySelector('.thumbnail-placeholder');
    expect(firstThumbnail).toBeTruthy();

    // Second gallery has no photos
    const secondThumbnail = galleryCards[1].querySelector('.thumbnail-empty');
    expect(secondThumbnail).toBeTruthy();
  });
});
