import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface DomainConfig {
  type?: 'subdomain' | 'custom';
  subdomain?: string;
  customDomain?: string;
  fullDomain?: string;
  status?: string;
  verificationToken?: string;
  dnsInstructions?: DNSRecord[];
  verifiedAt?: string;
}

interface DNSRecord {
  type: string;
  name: string;
  value: string;
  purpose: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-container">
      <h1>Settings</h1>

      <section class="settings-section">
        <h2>Custom Domain</h2>
        <p class="section-description">
          Set up a custom domain or subdomain for your photography portfolio.
        </p>

        @if (loading()) {
          <div class="loading">Loading domain settings...</div>
        } @else {
          <!-- Current Domain Display -->
          @if (domainConfig()?.fullDomain) {
            <div class="current-domain">
              <h3>Current Domain</h3>
              <div class="domain-info">
                <a [href]="'https://' + domainConfig()?.fullDomain" target="_blank" class="domain-link">
                  {{ domainConfig()?.fullDomain }}
                </a>
                <span class="status-badge" [class]="'status-' + domainConfig()?.status">
                  {{ domainConfig()?.status }}
                </span>
              </div>

              @if (domainConfig()?.status === 'pending_verification' && domainConfig()?.dnsInstructions) {
                <div class="dns-instructions">
                  <h4>DNS Setup Required</h4>
                  <p>Add the following DNS record to verify domain ownership:</p>
                  @for (record of domainConfig()?.dnsInstructions; track record.name) {
                    <div class="dns-record">
                      <div class="record-row">
                        <span class="label">Type:</span>
                        <code>{{ record.type }}</code>
                      </div>
                      <div class="record-row">
                        <span class="label">Name:</span>
                        <code>{{ record.name }}</code>
                      </div>
                      <div class="record-row">
                        <span class="label">Value:</span>
                        <code class="value">{{ record.value }}</code>
                      </div>
                    </div>
                  }
                  <button (click)="verifyDomain()" [disabled]="verifying()" class="btn btn-primary">
                    {{ verifying() ? 'Checking...' : 'Check Verification' }}
                  </button>
                </div>
              }

              <button (click)="removeDomain()" [disabled]="removing()" class="btn btn-danger">
                {{ removing() ? 'Removing...' : 'Remove Domain' }}
              </button>
            </div>
          }

          <!-- Subdomain Setup -->
          @if (!domainConfig()?.subdomain) {
            <div class="setup-section">
              <h3>Claim a Subdomain</h3>
              <p>Get a free subdomain on our platform.</p>
              <div class="input-group">
                <input
                  type="text"
                  [(ngModel)]="subdomainInput"
                  placeholder="yourname"
                  pattern="[a-z0-9-]+"
                  class="form-input"
                />
                <span class="input-suffix">.{{ baseDomain }}</span>
              </div>
              @if (subdomainError()) {
                <p class="error-text">{{ subdomainError() }}</p>
              }
              <button
                (click)="claimSubdomain()"
                [disabled]="claimingSubdomain() || !subdomainInput"
                class="btn btn-primary"
              >
                {{ claimingSubdomain() ? 'Claiming...' : 'Claim Subdomain' }}
              </button>
            </div>
          }

          <!-- Custom Domain Setup -->
          @if (!domainConfig()?.customDomain) {
            <div class="setup-section">
              <h3>Use Your Own Domain</h3>
              <p>Connect your own domain to your portfolio.</p>
              <div class="input-group">
                <input
                  type="text"
                  [(ngModel)]="customDomainInput"
                  placeholder="yourphotography.com"
                  class="form-input full-width"
                />
              </div>
              @if (customDomainError()) {
                <p class="error-text">{{ customDomainError() }}</p>
              }
              <button
                (click)="addCustomDomain()"
                [disabled]="addingCustomDomain() || !customDomainInput"
                class="btn btn-primary"
              >
                {{ addingCustomDomain() ? 'Adding...' : 'Add Custom Domain' }}
              </button>
            </div>
          }

          @if (successMessage()) {
            <div class="success-message">{{ successMessage() }}</div>
          }
        }
      </section>
    </div>
  `,
  styles: [`
    .settings-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    h1 {
      margin-bottom: 2rem;
      color: #333;
    }

    .settings-section {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .settings-section h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
    }

    .section-description {
      color: #666;
      margin-bottom: 1.5rem;
    }

    .loading {
      color: #666;
      padding: 1rem 0;
    }

    .current-domain {
      background: #f9f9f9;
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1.5rem;
    }

    .current-domain h3 {
      margin: 0 0 0.75rem 0;
      font-size: 1rem;
    }

    .domain-info {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .domain-link {
      font-size: 1.1rem;
      color: #0066cc;
    }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.8rem;
      text-transform: uppercase;
    }

    .status-active {
      background: #d4edda;
      color: #155724;
    }

    .status-pending_verification {
      background: #fff3cd;
      color: #856404;
    }

    .status-verified {
      background: #cce5ff;
      color: #004085;
    }

    .dns-instructions {
      background: #fff;
      border: 1px solid #ddd;
      padding: 1rem;
      border-radius: 4px;
      margin: 1rem 0;
    }

    .dns-instructions h4 {
      margin: 0 0 0.5rem 0;
      color: #856404;
    }

    .dns-record {
      background: #f5f5f5;
      padding: 0.75rem;
      border-radius: 4px;
      margin: 0.5rem 0;
    }

    .record-row {
      display: flex;
      gap: 0.5rem;
      margin: 0.25rem 0;
    }

    .record-row .label {
      font-weight: 600;
      min-width: 60px;
    }

    .record-row code {
      background: #e9ecef;
      padding: 0.1rem 0.4rem;
      border-radius: 3px;
      font-family: monospace;
    }

    .record-row code.value {
      word-break: break-all;
    }

    .setup-section {
      border-top: 1px solid #eee;
      padding-top: 1.5rem;
      margin-top: 1.5rem;
    }

    .setup-section h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
    }

    .setup-section p {
      color: #666;
      margin-bottom: 1rem;
    }

    .input-group {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-bottom: 0.5rem;
    }

    .form-input {
      padding: 0.5rem 0.75rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 1rem;
    }

    .form-input.full-width {
      flex: 1;
    }

    .input-suffix {
      color: #666;
    }

    .error-text {
      color: #dc3545;
      font-size: 0.9rem;
      margin: 0.5rem 0;
    }

    .success-message {
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      margin-top: 1rem;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: opacity 0.2s;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #0066cc;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #0052a3;
    }

    .btn-danger {
      background: #dc3545;
      color: white;
      margin-top: 1rem;
    }

    .btn-danger:hover:not(:disabled) {
      background: #c82333;
    }
  `]
})
export class SettingsComponent implements OnInit {
  private http = inject(HttpClient);

  domainConfig = signal<DomainConfig | null>(null);
  loading = signal(true);

  subdomainInput = '';
  customDomainInput = '';
  baseDomain = environment.baseDomain || 'photographergallery.com';

  subdomainError = signal<string | null>(null);
  customDomainError = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  claimingSubdomain = signal(false);
  addingCustomDomain = signal(false);
  verifying = signal(false);
  removing = signal(false);

  ngOnInit() {
    this.loadDomainConfig();
  }

  private loadDomainConfig() {
    this.loading.set(true);
    this.http.get<DomainConfig>(`${environment.apiUrl}/domain`)
      .subscribe({
        next: (config) => {
          this.domainConfig.set(config);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load domain config:', err);
          this.domainConfig.set({});
          this.loading.set(false);
        }
      });
  }

  claimSubdomain() {
    this.claimingSubdomain.set(true);
    this.subdomainError.set(null);
    this.successMessage.set(null);

    this.http.post<DomainConfig>(`${environment.apiUrl}/domain/subdomain`, {
      subdomain: this.subdomainInput.toLowerCase().trim()
    }).subscribe({
      next: (config) => {
        this.domainConfig.set(config);
        this.successMessage.set('Subdomain claimed successfully!');
        this.subdomainInput = '';
        this.claimingSubdomain.set(false);
      },
      error: (err) => {
        this.subdomainError.set(err.error?.message || 'Failed to claim subdomain');
        this.claimingSubdomain.set(false);
      }
    });
  }

  addCustomDomain() {
    this.addingCustomDomain.set(true);
    this.customDomainError.set(null);
    this.successMessage.set(null);

    this.http.post<DomainConfig>(`${environment.apiUrl}/domain/custom`, {
      domain: this.customDomainInput.toLowerCase().trim()
    }).subscribe({
      next: (config) => {
        this.domainConfig.set(config);
        this.successMessage.set('Custom domain added. Please configure the DNS records below.');
        this.customDomainInput = '';
        this.addingCustomDomain.set(false);
      },
      error: (err) => {
        this.customDomainError.set(err.error?.message || 'Failed to add custom domain');
        this.addingCustomDomain.set(false);
      }
    });
  }

  verifyDomain() {
    this.verifying.set(true);
    this.successMessage.set(null);

    this.http.post<any>(`${environment.apiUrl}/domain/verify`, {})
      .subscribe({
        next: (response) => {
          if (response.verified) {
            this.domainConfig.set(response.config);
            this.successMessage.set('Domain verified successfully!');
          } else {
            this.successMessage.set(response.message || 'Verification pending. Please check your DNS settings.');
          }
          this.verifying.set(false);
        },
        error: (err) => {
          this.successMessage.set(err.error?.message || 'Verification failed');
          this.verifying.set(false);
        }
      });
  }

  removeDomain() {
    if (!confirm('Are you sure you want to remove your custom domain?')) {
      return;
    }

    this.removing.set(true);
    this.http.delete(`${environment.apiUrl}/domain`)
      .subscribe({
        next: () => {
          this.domainConfig.set({});
          this.successMessage.set('Domain removed successfully');
          this.removing.set(false);
        },
        error: (err) => {
          console.error('Failed to remove domain:', err);
          this.removing.set(false);
        }
      });
  }
}
