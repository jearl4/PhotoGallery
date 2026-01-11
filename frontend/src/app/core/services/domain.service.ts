import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export type DomainMode = 'main' | 'photographer-portal';

export interface DomainContext {
  mode: DomainMode;
  isCustomDomain: boolean;
  subdomain?: string;
  customDomain?: string;
  fullHost: string;
}

@Injectable({
  providedIn: 'root'
})
export class DomainService {
  private context: DomainContext;
  private baseDomain: string;

  constructor() {
    this.baseDomain = environment.baseDomain || 'photographergallery.com';
    this.context = this.detectDomainContext();
  }

  private detectDomainContext(): DomainContext {
    const host = window.location.hostname.toLowerCase();

    // Development mode - localhost
    if (host === 'localhost' || host === '127.0.0.1') {
      return {
        mode: 'main',
        isCustomDomain: false,
        fullHost: host,
      };
    }

    // Check if it's the main domain (apex or www)
    if (host === this.baseDomain || host === `www.${this.baseDomain}`) {
      return {
        mode: 'main',
        isCustomDomain: false,
        fullHost: host,
      };
    }

    // Check if it's a subdomain of our base domain
    if (host.endsWith(`.${this.baseDomain}`)) {
      const subdomain = host.replace(`.${this.baseDomain}`, '');

      // Skip 'www' subdomain
      if (subdomain === 'www') {
        return {
          mode: 'main',
          isCustomDomain: false,
          fullHost: host,
        };
      }

      // Valid photographer subdomain
      return {
        mode: 'photographer-portal',
        isCustomDomain: true,
        subdomain,
        fullHost: host,
      };
    }

    // CloudFront domain or API Gateway domain - treat as main
    if (host.includes('.cloudfront.net') || host.includes('.execute-api.')) {
      return {
        mode: 'main',
        isCustomDomain: false,
        fullHost: host,
      };
    }

    // Any other domain is a custom domain
    return {
      mode: 'photographer-portal',
      isCustomDomain: true,
      customDomain: host,
      fullHost: host,
    };
  }

  /**
   * Get the current domain context
   */
  getContext(): DomainContext {
    return this.context;
  }

  /**
   * Check if we're in photographer portal mode (custom domain or subdomain)
   */
  isPhotographerPortal(): boolean {
    return this.context.mode === 'photographer-portal';
  }

  /**
   * Check if we're on a custom domain
   */
  isCustomDomain(): boolean {
    return this.context.isCustomDomain;
  }

  /**
   * Get the subdomain if we're on one
   */
  getSubdomain(): string | undefined {
    return this.context.subdomain;
  }

  /**
   * Get the custom domain if we're on one
   */
  getCustomDomain(): string | undefined {
    return this.context.customDomain;
  }

  /**
   * Get the API URL - always use the main API regardless of domain
   */
  getApiUrl(): string {
    return environment.apiUrl;
  }

  /**
   * Get the base domain
   */
  getBaseDomain(): string {
    return this.baseDomain;
  }
}
