import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService, AuthTokens } from './auth.service';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let mockRouter: jasmine.SpyObj<Router>;

  const mockTokens: AuthTokens = {
    accessToken: 'mock-access-token',
    idToken: 'mock-id-token',
    refreshToken: 'mock-refresh-token'
  };

  const mockUser: User = {
    userId: 'user_123',
    email: 'test@example.com',
    name: 'Test User',
    provider: 'google'
  };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: mockRouter }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialization', () => {
    it('should initialize with no authentication', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should load tokens from localStorage on init', () => {
      localStorage.setItem('auth_tokens', JSON.stringify(mockTokens));

      // Create new service instance to trigger initialization
      const newService = new AuthService();

      // Should attempt to load user profile
      const req = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUser);

      expect(newService.isAuthenticated()).toBe(true);
      expect(newService.getIdToken()).toBe(mockTokens.idToken);
    });
  });

  describe('login', () => {
    it('should redirect to Cognito OAuth URL', () => {
      const originalLocation = window.location.href;

      // Mock window.location
      delete (window as any).location;
      (window as any).location = { href: originalLocation, origin: 'http://localhost:4200' };

      service.login();

      expect(window.location.href).toContain('amazoncognito.com/oauth2/authorize');
      expect(window.location.href).toContain(`client_id=${environment.cognitoClientId}`);
      expect(window.location.href).toContain('response_type=code');
      expect(window.location.href).toContain('scope=openid email profile');
      expect(window.location.href).toContain('redirect_uri');

      // Restore original location
      (window as any).location = { href: originalLocation };
    });
  });

  describe('handleCallback', () => {
    it('should exchange code for tokens and load user profile', (done) => {
      const authCode = 'test-auth-code-123';

      service.handleCallback(authCode).subscribe(success => {
        expect(success).toBe(true);
        expect(service.isAuthenticated()).toBe(true);
        expect(service.getIdToken()).toBe(mockTokens.idToken);
        expect(service.getAccessToken()).toBe(mockTokens.accessToken);

        // Verify tokens are stored
        const stored = localStorage.getItem('auth_tokens');
        expect(stored).toBeTruthy();
        const storedTokens = JSON.parse(stored!);
        expect(storedTokens.idToken).toBe(mockTokens.idToken);

        done();
      });

      // Expect token exchange request
      const tokenReq = httpMock.expectOne(req =>
        req.url.includes('amazoncognito.com/oauth2/token')
      );
      expect(tokenReq.request.method).toBe('POST');
      expect(tokenReq.request.headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');

      tokenReq.flush({
        access_token: mockTokens.accessToken,
        id_token: mockTokens.idToken,
        refresh_token: mockTokens.refreshToken
      });

      // Expect user profile request
      const userReq = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
      expect(userReq.request.method).toBe('GET');
      userReq.flush(mockUser);
    });

    it('should return false on token exchange failure', (done) => {
      const authCode = 'invalid-code';

      service.handleCallback(authCode).subscribe(success => {
        expect(success).toBe(false);
        expect(service.isAuthenticated()).toBe(false);
        done();
      });

      const tokenReq = httpMock.expectOne(req =>
        req.url.includes('amazoncognito.com/oauth2/token')
      );
      tokenReq.error(new ProgressEvent('error'), { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('loadUserProfile', () => {
    it('should load user profile and update state', (done) => {
      // Manually set tokens first
      service['tokensSubject'].next(mockTokens);
      service.isAuthenticated.set(true);

      service['loadUserProfile']().subscribe(user => {
        expect(user).toEqual(mockUser);
        expect(service.isLoading()).toBe(false);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
      req.flush(mockUser);

      // Verify user is set in observable
      service.currentUser$.subscribe(user => {
        if (user) {
          expect(user).toEqual(mockUser);
        }
      });
    });

    it('should logout on profile load failure', (done) => {
      service['tokensSubject'].next(mockTokens);
      service.isAuthenticated.set(true);

      service['loadUserProfile']().subscribe(() => {
        expect(service.isAuthenticated()).toBe(false);
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
      req.error(new ProgressEvent('error'), { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('logout', () => {
    it('should clear tokens and navigate to home', () => {
      // Set up authenticated state
      localStorage.setItem('auth_tokens', JSON.stringify(mockTokens));
      service['tokensSubject'].next(mockTokens);
      service['currentUserSubject'].next(mockUser);
      service.isAuthenticated.set(true);

      service.logout();

      expect(service.isAuthenticated()).toBe(false);
      expect(service.getIdToken()).toBeNull();
      expect(localStorage.getItem('auth_tokens')).toBeNull();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);

      service.currentUser$.subscribe(user => {
        expect(user).toBeNull();
      });
    });
  });

  describe('token management', () => {
    it('should get access token', () => {
      service['tokensSubject'].next(mockTokens);
      expect(service.getAccessToken()).toBe(mockTokens.accessToken);
    });

    it('should return null when no access token', () => {
      service['tokensSubject'].next(null);
      expect(service.getAccessToken()).toBeNull();
    });

    it('should get ID token', () => {
      service['tokensSubject'].next(mockTokens);
      expect(service.getIdToken()).toBe(mockTokens.idToken);
    });

    it('should return null when no ID token', () => {
      service['tokensSubject'].next(null);
      expect(service.getIdToken()).toBeNull();
    });

    it('should store tokens in localStorage', () => {
      service['storeTokens'](mockTokens);
      const stored = localStorage.getItem('auth_tokens');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed).toEqual(mockTokens);
    });

    it('should retrieve tokens from localStorage', () => {
      localStorage.setItem('auth_tokens', JSON.stringify(mockTokens));
      const tokens = service['getStoredTokens']();
      expect(tokens).toEqual(mockTokens);
    });

    it('should return null when no stored tokens', () => {
      const tokens = service['getStoredTokens']();
      expect(tokens).toBeNull();
    });

    it('should clear tokens from localStorage', () => {
      localStorage.setItem('auth_tokens', JSON.stringify(mockTokens));
      service['clearStoredTokens']();
      expect(localStorage.getItem('auth_tokens')).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token using refresh token', (done) => {
      service['tokensSubject'].next(mockTokens);

      const newTokens: AuthTokens = {
        accessToken: 'new-access-token',
        idToken: 'new-id-token',
        refreshToken: mockTokens.refreshToken
      };

      service.refreshAccessToken().subscribe(tokens => {
        expect(tokens.accessToken).toBe(newTokens.accessToken);
        expect(tokens.idToken).toBe(newTokens.idToken);
        expect(service.getAccessToken()).toBe(newTokens.accessToken);

        // Verify tokens are stored
        const stored = localStorage.getItem('auth_tokens');
        const storedTokens = JSON.parse(stored!);
        expect(storedTokens.accessToken).toBe(newTokens.accessToken);

        done();
      });

      const req = httpMock.expectOne(req =>
        req.url.includes('amazoncognito.com/oauth2/token')
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toContain('grant_type=refresh_token');
      expect(req.request.body).toContain(`refresh_token=${mockTokens.refreshToken}`);

      req.flush({
        access_token: newTokens.accessToken,
        id_token: newTokens.idToken
      });
    });

    it('should throw error when no refresh token available', () => {
      service['tokensSubject'].next({ accessToken: 'token', idToken: 'token' });

      expect(() => {
        service.refreshAccessToken().subscribe();
      }).toThrowError('No refresh token available');
    });

    it('should throw error when no tokens at all', () => {
      service['tokensSubject'].next(null);

      expect(() => {
        service.refreshAccessToken().subscribe();
      }).toThrowError('No refresh token available');
    });
  });

  describe('isAuthenticatedSync', () => {
    it('should return true when authenticated', () => {
      service.isAuthenticated.set(true);
      expect(service.isAuthenticatedSync()).toBe(true);
    });

    it('should return false when not authenticated', () => {
      service.isAuthenticated.set(false);
      expect(service.isAuthenticatedSync()).toBe(false);
    });
  });

  describe('observables', () => {
    it('should emit currentUser$ updates', (done) => {
      service.currentUser$.subscribe(user => {
        if (user) {
          expect(user).toEqual(mockUser);
          done();
        }
      });

      service['currentUserSubject'].next(mockUser);
    });

    it('should emit tokens$ updates', (done) => {
      service.tokens$.subscribe(tokens => {
        if (tokens) {
          expect(tokens).toEqual(mockTokens);
          done();
        }
      });

      service['tokensSubject'].next(mockTokens);
    });
  });
});
