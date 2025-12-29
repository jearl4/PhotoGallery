import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard to protect photographer routes
 * Redirects to home if not authenticated
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticatedSync()) {
    return true;
  }

  // Store the attempted URL for redirecting after login
  router.navigate(['/'], { queryParams: { returnUrl: state.url } });
  return false;
};

/**
 * Guard to redirect authenticated users away from login page
 */
export const noAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticatedSync()) {
    router.navigate(['/photographer/dashboard']);
    return false;
  }

  return true;
};
