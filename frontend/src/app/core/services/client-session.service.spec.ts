import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ClientSessionService, VerifyPasswordResponse, ClientSession } from './client-session.service';
import { environment } from '../../../environments/environment';
import { Gallery } from '../models/gallery.model';

describe('ClientSessionService', () => {
  let service: ClientSessionService;
  let httpMock: HttpTestingController;

  const mockGallery: Gallery = {
    galleryId: 'gal_123',
    photographerId: 'user_123',
    name: 'Test Gallery',
    description: 'Test Description',
    customUrl: 'test-gallery',
    password: 'hashed_password',
    createdAt: '2024-01-01T00:00:00Z',
    status: 'active',
    photoCount: 5,
    totalSize: 1024000,
    clientAccessCount: 10
  };

  const mockVerifyResponse: VerifyPasswordResponse = {
    sessionToken: 'test-session-token-123',
    gallery: mockGallery
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ClientSessionService]
    });
    service = TestBed.inject(ClientSessionService);
    httpMock = TestBed.inject(HttpTestingController);

    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('verifyPassword', () => {
    it('should verify password and create session', (done) => {
      const customUrl = 'test-gallery';
      const password = 'password123';

      service.verifyPassword(customUrl, password).subscribe(response => {
        expect(response).toEqual(mockVerifyResponse);
        expect(service.hasActiveSession()).toBe(true);
        expect(service.getSessionToken()).toBe('test-session-token-123');
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/verify`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ customUrl, password });
      req.flush(mockVerifyResponse);
    });

    it('should store session in localStorage', (done) => {
      service.verifyPassword('test-gallery', 'password123').subscribe(() => {
        const stored = localStorage.getItem('client_session');
        expect(stored).toBeTruthy();

        const session = JSON.parse(stored!);
        expect(session.sessionToken).toBe('test-session-token-123');
        expect(session.customUrl).toBe('test-gallery');
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/verify`);
      req.flush(mockVerifyResponse);
    });

    it('should update hasSession signal', (done) => {
      expect(service.hasSession()).toBe(false);

      service.verifyPassword('test-gallery', 'password123').subscribe(() => {
        expect(service.hasSession()).toBe(true);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/verify`);
      req.flush(mockVerifyResponse);
    });
  });

  describe('getSessionToken', () => {
    it('should return null when no session exists', () => {
      expect(service.getSessionToken()).toBeNull();
    });

    it('should return session token when session exists', (done) => {
      service.verifyPassword('test-gallery', 'password123').subscribe(() => {
        expect(service.getSessionToken()).toBe('test-session-token-123');
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/verify`);
      req.flush(mockVerifyResponse);
    });
  });

  describe('getCurrentGallery', () => {
    it('should return null when no session exists', () => {
      expect(service.getCurrentGallery()).toBeNull();
    });

    it('should return gallery when session exists', (done) => {
      service.verifyPassword('test-gallery', 'password123').subscribe(() => {
        const gallery = service.getCurrentGallery();
        expect(gallery).toEqual(mockGallery);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/verify`);
      req.flush(mockVerifyResponse);
    });
  });

  describe('hasActiveSession', () => {
    it('should return false initially', () => {
      expect(service.hasActiveSession()).toBe(false);
    });

    it('should return true after successful verification', (done) => {
      service.verifyPassword('test-gallery', 'password123').subscribe(() => {
        expect(service.hasActiveSession()).toBe(true);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/verify`);
      req.flush(mockVerifyResponse);
    });
  });

  describe('clearSession', () => {
    it('should clear session and localStorage', (done) => {
      service.verifyPassword('test-gallery', 'password123').subscribe(() => {
        expect(service.hasActiveSession()).toBe(true);

        service.clearSession();

        expect(service.hasActiveSession()).toBe(false);
        expect(service.getSessionToken()).toBeNull();
        expect(localStorage.getItem('client_session')).toBeNull();
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/verify`);
      req.flush(mockVerifyResponse);
    });
  });

  describe('loadStoredSession', () => {
    it('should load session from localStorage on init', () => {
      const storedSession: ClientSession = {
        sessionToken: 'stored-token',
        gallery: mockGallery,
        customUrl: 'test-gallery'
      };

      localStorage.setItem('client_session', JSON.stringify(storedSession));

      // Create new service instance to trigger constructor
      const newService = new ClientSessionService();

      expect(newService.hasActiveSession()).toBe(true);
      expect(newService.getSessionToken()).toBe('stored-token');
    });

    it('should handle invalid stored session', () => {
      localStorage.setItem('client_session', 'invalid-json');

      const newService = new ClientSessionService();

      expect(newService.hasActiveSession()).toBe(false);
      expect(localStorage.getItem('client_session')).toBeNull();
    });
  });

  describe('getSessionForGallery', () => {
    it('should return null when no session exists', () => {
      expect(service.getSessionForGallery('test-gallery')).toBeNull();
    });

    it('should return session for matching gallery', (done) => {
      service.verifyPassword('test-gallery', 'password123').subscribe(() => {
        const session = service.getSessionForGallery('test-gallery');
        expect(session).toBeTruthy();
        expect(session?.customUrl).toBe('test-gallery');
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/verify`);
      req.flush(mockVerifyResponse);
    });

    it('should return null for non-matching gallery', (done) => {
      service.verifyPassword('test-gallery', 'password123').subscribe(() => {
        const session = service.getSessionForGallery('other-gallery');
        expect(session).toBeNull();
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/client/verify`);
      req.flush(mockVerifyResponse);
    });
  });

  describe('currentSession$ observable', () => {
    it('should emit null initially', (done) => {
      service.currentSession$.subscribe(session => {
        expect(session).toBeNull();
        done();
      });
    });

    it('should emit session after verification', (done) => {
      let emissionCount = 0;

      service.currentSession$.subscribe(session => {
        emissionCount++;
        if (emissionCount === 2) { // Skip initial null emission
          expect(session).toBeTruthy();
          expect(session?.sessionToken).toBe('test-session-token-123');
          done();
        }
      });

      service.verifyPassword('test-gallery', 'password123').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/client/verify`);
      req.flush(mockVerifyResponse);
    });
  });
});
