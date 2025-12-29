import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ClientSessionService } from '../services/client-session.service';

export const clientSessionInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionService = inject(ClientSessionService);

  // Only add session token to client API requests
  if (req.url.includes('/client/') && !req.url.includes('/client/verify')) {
    const sessionToken = sessionService.getSessionToken();
    if (sessionToken) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${sessionToken}`
        }
      });
    }
  }

  return next(req);
};
