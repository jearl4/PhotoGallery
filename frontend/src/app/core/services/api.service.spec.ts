import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { Gallery, CreateGalleryRequest } from '../models/gallery.model';
import { Photo } from '../models/photo.model';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  const mockGallery: Gallery = {
    galleryId: 'gal_123',
    photographerId: 'user_123',
    name: 'Test Gallery',
    description: 'Test Description',
    customUrl: 'test-gallery',
    password: 'hashed',
    createdAt: '2024-01-01T00:00:00Z',
    status: 'active',
    photoCount: 5,
    totalSize: 1024000,
    clientAccessCount: 10
  };

  const mockPhoto: Photo = {
    photoId: 'photo_123',
    galleryId: 'gal_123',
    fileName: 'test.jpg',
    originalKey: 'original/test.jpg',
    optimizedKey: 'optimized/test.jpg',
    thumbnailKey: 'thumbnail/test.jpg',
    mimeType: 'image/jpeg',
    size: 102400,
    width: 1920,
    height: 1080,
    uploadedAt: '2024-01-01T00:00:00Z',
    favoriteCount: 2,
    downloadCount: 5
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Gallery endpoints', () => {
    it('should create gallery', (done) => {
      const request: CreateGalleryRequest = {
        name: 'New Gallery',
        password: 'password123'
      };

      service.createGallery(request).subscribe(gallery => {
        expect(gallery).toEqual(mockGallery);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/galleries`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockGallery);
    });

    it('should get galleries with pagination', (done) => {
      const mockResponse = { galleries: [mockGallery], lastKey: 'key123' };

      service.getGalleries(20, 'lastKey').subscribe(response => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(
        (request) => request.url === `${environment.apiUrl}/galleries`
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('limit')).toBe('20');
      req.flush(mockResponse);
    });

    it('should get single gallery', (done) => {
      service.getGallery('gal_123').subscribe(gallery => {
        expect(gallery).toEqual(mockGallery);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/galleries/gal_123`);
      expect(req.request.method).toBe('GET');
      req.flush(mockGallery);
    });

    it('should update gallery', (done) => {
      const updateRequest = { name: 'Updated Name' };

      service.updateGallery('gal_123', updateRequest).subscribe(gallery => {
        expect(gallery).toEqual(mockGallery);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/galleries/gal_123`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateRequest);
      req.flush(mockGallery);
    });

    it('should delete gallery', (done) => {
      service.deleteGallery('gal_123').subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/galleries/gal_123`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should set gallery expiration', (done) => {
      const expiresAt = '2024-12-31T23:59:59Z';

      service.setGalleryExpiration('gal_123', expiresAt).subscribe(gallery => {
        expect(gallery).toEqual(mockGallery);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/galleries/gal_123/expire`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ expiresAt });
      req.flush(mockGallery);
    });
  });

  describe('Photo endpoints', () => {
    it('should get upload URL', (done) => {
      const mockResponse = {
        photoId: 'photo_123',
        uploadUrl: 'https://s3.amazonaws.com/upload',
        key: 'original/photo.jpg'
      };

      service.getUploadUrl('gal_123', 'photo.jpg', 'image/jpeg').subscribe(response => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/galleries/gal_123/photos/upload-url`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ fileName: 'photo.jpg', mimeType: 'image/jpeg' });
      req.flush(mockResponse);
    });

    it('should get gallery photos', (done) => {
      const mockResponse = { photos: [mockPhoto] };

      service.getGalleryPhotos('gal_123').subscribe(response => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(
        (request) => request.url === `${environment.apiUrl}/galleries/gal_123/photos`
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should delete photo', (done) => {
      service.deletePhoto('gal_123', 'photo_123').subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/galleries/gal_123/photos/photo_123`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should get gallery favorites', (done) => {
      const mockResponse = { favorites: [{ photoId: 'photo_123', favoritedAt: '2024-01-01T00:00:00Z' }] };

      service.getGalleryFavorites('gal_123').subscribe(response => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/galleries/gal_123/favorites`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });

  describe('Client endpoints', () => {
    it('should verify gallery password', (done) => {
      const mockResponse = { sessionToken: 'token123' };

      service.verifyGalleryPassword('test-gallery', 'password123').subscribe(response => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/verify`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ customUrl: 'test-gallery', password: 'password123' });
      req.flush(mockResponse);
    });

    it('should get client gallery', (done) => {
      service.getClientGallery('test-gallery').subscribe(gallery => {
        expect(gallery).toEqual(mockGallery);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/galleries/test-gallery`);
      expect(req.request.method).toBe('GET');
      req.flush(mockGallery);
    });

    it('should get client gallery photos', (done) => {
      const mockResponse = { photos: [mockPhoto] };

      service.getClientGalleryPhotos('test-gallery').subscribe(response => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(
        (request) => request.url === `${environment.apiUrl}/client/galleries/test-gallery/photos`
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should get photo download URL', (done) => {
      const mockResponse = { downloadUrl: 'https://cdn.example.com/photo.jpg' };

      service.getPhotoDownloadUrl('photo_123').subscribe(response => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/photos/photo_123/download-url`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should toggle favorite', (done) => {
      const mockResponse = { isFavorited: true };

      service.toggleFavorite('photo_123').subscribe(response => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/photos/photo_123/favorite`);
      expect(req.request.method).toBe('POST');
      req.flush(mockResponse);
    });

    it('should get client favorites', (done) => {
      const mockResponse = { favorites: [{ photoId: 'photo_123', favoritedAt: '2024-01-01T00:00:00Z' }] };

      service.getClientFavorites().subscribe(response => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/session/favorites`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });

  describe('Error handling', () => {
    it('should handle HTTP errors', (done) => {
      service.getGallery('gal_123').subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.status).toBe(404);
          done();
        }
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/galleries/gal_123`);
      req.flush('Not found', { status: 404, statusText: 'Not Found' });
    });
  });
});
