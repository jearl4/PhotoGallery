import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Gallery } from '../models/gallery.model';

export interface VerifyPasswordRequest {
  customUrl: string;
  password: string;
}

export interface VerifyPasswordResponse {
  sessionToken: string;
  gallery: Gallery;
}

export interface ClientSession {
  sessionToken: string;
  gallery: Gallery;
  customUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClientSessionService {
  private http = inject(HttpClient);

  private currentSessionSubject = new BehaviorSubject<ClientSession | null>(null);
  public currentSession$ = this.currentSessionSubject.asObservable();

  public hasSession = signal<boolean>(false);

  constructor() {
    this.loadStoredSession();
  }

  /**
   * Verify gallery password and create session
   */
  verifyPassword(customUrl: string, password: string): Observable<VerifyPasswordResponse> {
    return this.http.post<VerifyPasswordResponse>(
      `${environment.apiUrl}/client/verify`,
      { customUrl, password }
    ).pipe(
      tap(response => {
        const session: ClientSession = {
          sessionToken: response.sessionToken,
          gallery: response.gallery,
          customUrl
        };
        this.setSession(session);
      })
    );
  }

  /**
   * Get current session token
   */
  getSessionToken(): string | null {
    return this.currentSessionSubject.value?.sessionToken || null;
  }

  /**
   * Get current gallery
   */
  getCurrentGallery(): Gallery | null {
    return this.currentSessionSubject.value?.gallery || null;
  }

  /**
   * Check if user has active session
   */
  hasActiveSession(): boolean {
    return this.hasSession();
  }

  /**
   * Clear session and logout
   */
  clearSession(): void {
    localStorage.removeItem('client_session');
    this.currentSessionSubject.next(null);
    this.hasSession.set(false);
  }

  /**
   * Store session
   */
  private setSession(session: ClientSession): void {
    localStorage.setItem('client_session', JSON.stringify(session));
    this.currentSessionSubject.next(session);
    this.hasSession.set(true);
  }

  /**
   * Load session from storage on init
   */
  private loadStoredSession(): void {
    const stored = localStorage.getItem('client_session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        this.currentSessionSubject.next(session);
        this.hasSession.set(true);
      } catch (error) {
        console.error('Failed to load stored session:', error);
        localStorage.removeItem('client_session');
      }
    }
  }

  /**
   * Get session for specific gallery
   */
  getSessionForGallery(customUrl: string): ClientSession | null {
    const session = this.currentSessionSubject.value;
    if (session && session.customUrl === customUrl) {
      return session;
    }
    return null;
  }
}
