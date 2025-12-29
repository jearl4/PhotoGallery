import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private tokensSubject = new BehaviorSubject<AuthTokens | null>(null);
  public tokens$ = this.tokensSubject.asObservable();

  public isAuthenticated = signal<boolean>(false);
  public isLoading = signal<boolean>(true);

  constructor() {
    this.initializeAuth();
  }

  private initializeAuth(): void {
    const tokens = this.getStoredTokens();
    if (tokens) {
      this.tokensSubject.next(tokens);
      this.isAuthenticated.set(true);
      this.loadUserProfile().subscribe();
    } else {
      this.isLoading.set(false);
    }
  }

  /**
   * Initiate Cognito OAuth login flow
   */
  login(): void {
    const { cognitoDomain, cognitoClientId, cognitoRegion } = environment;
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
    const responseType = 'code';
    const scope = 'openid email profile';

    const authUrl = `https://${cognitoDomain}.auth.${cognitoRegion}.amazoncognito.com/oauth2/authorize?` +
      `client_id=${cognitoClientId}&` +
      `response_type=${responseType}&` +
      `scope=${scope}&` +
      `redirect_uri=${redirectUri}`;

    window.location.href = authUrl;
  }

  /**
   * Handle OAuth callback with authorization code
   */
  handleCallback(code: string): Observable<boolean> {
    return this.exchangeCodeForTokens(code).pipe(
      tap(tokens => {
        this.storeTokens(tokens);
        this.tokensSubject.next(tokens);
        this.isAuthenticated.set(true);
      }),
      tap(() => this.loadUserProfile().subscribe()),
      map(() => true),
      catchError(error => {
        console.error('Auth callback error:', error);
        return of(false);
      })
    );
  }

  /**
   * Exchange authorization code for tokens
   */
  private exchangeCodeForTokens(code: string): Observable<AuthTokens> {
    const { cognitoDomain, cognitoClientId, cognitoRegion } = environment;
    const redirectUri = window.location.origin + '/auth/callback';

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cognitoClientId,
      code: code,
      redirect_uri: redirectUri
    });

    const tokenUrl = `https://${cognitoDomain}.auth.${cognitoRegion}.amazoncognito.com/oauth2/token`;

    return this.http.post<any>(tokenUrl, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }).pipe(
      map(response => ({
        accessToken: response.access_token,
        idToken: response.id_token,
        refreshToken: response.refresh_token
      }))
    );
  }

  /**
   * Load user profile from API
   */
  private loadUserProfile(): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/auth/me`).pipe(
      tap(user => {
        this.currentUserSubject.next(user);
        this.isLoading.set(false);
      }),
      catchError(error => {
        console.error('Failed to load user profile:', error);
        this.isLoading.set(false);
        // Don't logout on profile load failure - just log the error
        // The user is still authenticated via Cognito
        return of({} as User);
      })
    );
  }

  /**
   * Logout and clear session
   */
  logout(): void {
    this.clearStoredTokens();
    this.tokensSubject.next(null);
    this.currentUserSubject.next(null);
    this.isAuthenticated.set(false);
    this.router.navigate(['/']);
  }

  /**
   * Get the current access token
   */
  getAccessToken(): string | null {
    const tokens = this.tokensSubject.value;
    return tokens?.accessToken || null;
  }

  /**
   * Get the current ID token (for Cognito authentication)
   */
  getIdToken(): string | null {
    const tokens = this.tokensSubject.value;
    return tokens?.idToken || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticatedSync(): boolean {
    return this.isAuthenticated();
  }

  /**
   * Store tokens in localStorage
   */
  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
  }

  /**
   * Retrieve tokens from localStorage
   */
  private getStoredTokens(): AuthTokens | null {
    const stored = localStorage.getItem('auth_tokens');
    return stored ? JSON.parse(stored) : null;
  }

  /**
   * Clear stored tokens
   */
  private clearStoredTokens(): void {
    localStorage.removeItem('auth_tokens');
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(): Observable<AuthTokens> {
    const currentTokens = this.tokensSubject.value;
    if (!currentTokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const { cognitoDomain, cognitoClientId, cognitoRegion } = environment;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: cognitoClientId,
      refresh_token: currentTokens.refreshToken
    });

    const tokenUrl = `https://${cognitoDomain}.auth.${cognitoRegion}.amazoncognito.com/oauth2/token`;

    return this.http.post<any>(tokenUrl, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }).pipe(
      map(response => ({
        accessToken: response.access_token,
        idToken: response.id_token,
        refreshToken: currentTokens.refreshToken
      })),
      tap(tokens => {
        this.storeTokens(tokens);
        this.tokensSubject.next(tokens);
      })
    );
  }
}
