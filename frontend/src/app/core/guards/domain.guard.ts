import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DomainService } from '../services/domain.service';

/**
 * Guard that only allows access when on a custom domain (subdomain or BYOD)
 */
export const portalOnlyGuard: CanActivateFn = () => {
  const domainService = inject(DomainService);
  const router = inject(Router);

  if (domainService.isPhotographerPortal()) {
    return true;
  }

  // Not on a custom domain, redirect to main app
  router.navigate(['/']);
  return false;
};

/**
 * Guard that only allows access when on the main domain
 */
export const mainDomainOnlyGuard: CanActivateFn = () => {
  const domainService = inject(DomainService);
  const router = inject(Router);

  if (!domainService.isPhotographerPortal()) {
    return true;
  }

  // On a custom domain, redirect to portal home
  router.navigate(['/']);
  return false;
};

/**
 * Guard that redirects based on domain context
 * Use this for the root path to show different content
 */
export const domainRedirectGuard: CanActivateFn = () => {
  const domainService = inject(DomainService);
  const router = inject(Router);

  if (domainService.isPhotographerPortal()) {
    // On custom domain - redirect to portal home
    router.navigate(['/portal']);
    return false;
  }

  // On main domain - allow access to login
  return true;
};
