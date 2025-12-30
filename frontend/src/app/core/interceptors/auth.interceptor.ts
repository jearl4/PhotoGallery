import { HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
}

function getStoredTokens(): AuthTokens | null {
  const stored = localStorage.getItem('auth_tokens');
  return stored ? JSON.parse(stored) : null;
}

function getIdToken(): string | null {
  const tokens = getStoredTokens();
  return tokens?.idToken || null;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip auth for Cognito token endpoints
  if (req.url.includes('amazoncognito.com/oauth2/token')) {
    return next(req);
  }

  // Skip auth for client endpoints (they use session tokens)
  if (req.url.includes('/client/')) {
    return next(req);
  }

  // Add ID token to photographer API requests
  const idToken = getIdToken();
  if (idToken) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${idToken}`
      }
    });
  }

  return next(req).pipe(
    catchError(error => {
      // Handle 401 Unauthorized - redirect to login
      if (error.status === 401 && idToken) {
        localStorage.removeItem('auth_tokens');
        window.location.href = '/';
      }

      return throwError(() => error);
    })
  );
};
