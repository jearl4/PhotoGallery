import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Skip auth for Cognito token endpoints
  if (req.url.includes('amazoncognito.com/oauth2/token')) {
    return next(req);
  }

  // Skip auth for client endpoints (they use session tokens)
  if (req.url.includes('/client/')) {
    return next(req);
  }

  // Add ID token to photographer API requests
  const idToken = authService.getIdToken();
  if (idToken) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${idToken}`
      }
    });
  }

  return next(req).pipe(
    catchError(error => {
      // Handle 401 Unauthorized - try to refresh token
      if (error.status === 401 && idToken) {
        return authService.refreshAccessToken().pipe(
          switchMap(() => {
            // Retry request with new token
            const newToken = authService.getIdToken();
            const retryReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${newToken}`
              }
            });
            return next(retryReq);
          }),
          catchError(refreshError => {
            // Refresh failed, logout user
            authService.logout();
            return throwError(() => refreshError);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
