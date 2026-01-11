import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { HeaderComponent } from '../../../shared/components/header/header.component';

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
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent],
  template: `
    <div class="settings-page">
      <app-header />

      <main class="main">
        <div class="container">
          <!-- Breadcrumb -->
          <nav class="breadcrumb">
            <a routerLink="/photographer/dashboard">Galleries</a>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span>Settings</span>
          </nav>

          <div class="page-header">
            <h1>Settings</h1>
            <p class="page-description">Manage your portfolio domain and account preferences</p>
          </div>

          <!-- Domain Section -->
          <section class="card">
            <div class="card-header">
              <div class="card-header-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </div>
              <div class="card-header-text">
                <h2>Custom Domain</h2>
                <p>Set up a custom domain or subdomain for your photography portfolio</p>
              </div>
            </div>

            <div class="card-body">
              @if (loading()) {
                <div class="loading-state">
                  <div class="spinner"></div>
                  <p>Loading domain settings...</p>
                </div>
              } @else {
                <!-- Active Domain Display -->
                @if (domainConfig()?.fullDomain) {
                  <div class="active-domain">
                    <div class="domain-display">
                      <div class="domain-url-wrapper">
                        <span class="domain-label">Your portfolio URL</span>
                        <div class="domain-url">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                          <a [href]="'https://' + domainConfig()?.fullDomain" target="_blank" class="domain-link">
                            {{ domainConfig()?.fullDomain }}
                          </a>
                          <button class="copy-btn" (click)="copyToClipboard('https://' + domainConfig()?.fullDomain)" title="Copy URL">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div class="status-wrapper">
                        @switch (domainConfig()?.status) {
                          @case ('active') {
                            <span class="status-chip status-active">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              Active
                            </span>
                          }
                          @case ('pending_verification') {
                            <span class="status-chip status-pending">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                              </svg>
                              Pending Verification
                            </span>
                          }
                          @case ('verified') {
                            <span class="status-chip status-verified">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                              </svg>
                              Verified
                            </span>
                          }
                        }
                      </div>
                    </div>

                    <!-- DNS Verification Instructions -->
                    @if (domainConfig()?.status === 'pending_verification' && domainConfig()?.dnsInstructions) {
                      <div class="dns-card">
                        <div class="dns-header">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                          </svg>
                          <div>
                            <h4>DNS Configuration Required</h4>
                            <p>Add the following DNS record to verify domain ownership</p>
                          </div>
                        </div>

                        @for (record of domainConfig()?.dnsInstructions; track record.name) {
                          <div class="dns-record">
                            <div class="dns-field">
                              <span class="dns-label">Type</span>
                              <code class="dns-value">{{ record.type }}</code>
                            </div>
                            <div class="dns-field">
                              <span class="dns-label">Name / Host</span>
                              <div class="dns-value-row">
                                <code class="dns-value">{{ record.name }}</code>
                                <button class="copy-btn-small" (click)="copyToClipboard(record.name)" title="Copy">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div class="dns-field">
                              <span class="dns-label">Value / Points to</span>
                              <div class="dns-value-row">
                                <code class="dns-value dns-value-long">{{ record.value }}</code>
                                <button class="copy-btn-small" (click)="copyToClipboard(record.value)" title="Copy">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        }

                        <div class="dns-actions">
                          <button class="btn btn-primary" (click)="verifyDomain()" [disabled]="verifying()">
                            @if (verifying()) {
                              <span class="btn-spinner"></span>
                              Checking...
                            } @else {
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="23 4 23 10 17 10"/>
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                              </svg>
                              Check Verification
                            }
                          </button>
                          <p class="dns-note">DNS changes can take up to 48 hours to propagate</p>
                        </div>
                      </div>
                    }

                    <div class="domain-actions">
                      <button class="btn btn-danger-outline" (click)="removeDomain()" [disabled]="removing()">
                        @if (removing()) {
                          <span class="btn-spinner"></span>
                          Removing...
                        } @else {
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                          Remove Domain
                        }
                      </button>
                    </div>
                  </div>
                } @else {
                  <!-- No domain configured - Show setup options -->
                  <div class="domain-options">
                    <!-- Subdomain Option -->
                    <div class="option-card">
                      <div class="option-header">
                        <div class="option-icon option-icon-free">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                          </svg>
                        </div>
                        <div>
                          <h3>Free Subdomain</h3>
                          <span class="option-badge">Recommended</span>
                        </div>
                      </div>
                      <p class="option-description">
                        Get a free subdomain on our platform. Perfect for getting started quickly.
                      </p>
                      <div class="subdomain-input-group">
                        <input
                          type="text"
                          [(ngModel)]="subdomainInput"
                          placeholder="yourname"
                          pattern="[a-z0-9-]+"
                          class="subdomain-input"
                          (input)="onSubdomainInput($event)"
                        />
                        <span class="subdomain-suffix">.{{ baseDomain }}</span>
                      </div>
                      @if (subdomainInput) {
                        <p class="preview-url">Your URL: <strong>https://{{ subdomainInput }}.{{ baseDomain }}</strong></p>
                      }
                      @if (subdomainError()) {
                        <p class="error-message">{{ subdomainError() }}</p>
                      }
                      <button
                        class="btn btn-primary btn-full"
                        (click)="claimSubdomain()"
                        [disabled]="claimingSubdomain() || !subdomainInput"
                      >
                        @if (claimingSubdomain()) {
                          <span class="btn-spinner"></span>
                          Claiming...
                        } @else {
                          Claim Subdomain
                        }
                      </button>
                    </div>

                    <!-- Divider -->
                    <div class="options-divider">
                      <span>or</span>
                    </div>

                    <!-- Custom Domain Option -->
                    <div class="option-card">
                      <div class="option-header">
                        <div class="option-icon option-icon-custom">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="2" y1="12" x2="22" y2="12"/>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                          </svg>
                        </div>
                        <div>
                          <h3>Custom Domain</h3>
                          <span class="option-badge option-badge-pro">Pro</span>
                        </div>
                      </div>
                      <p class="option-description">
                        Use your own domain for a fully branded experience. Requires DNS configuration.
                      </p>
                      <div class="custom-domain-input-group">
                        <span class="protocol-prefix">https://</span>
                        <input
                          type="text"
                          [(ngModel)]="customDomainInput"
                          placeholder="yourphotography.com"
                          class="custom-domain-input"
                        />
                      </div>
                      @if (customDomainError()) {
                        <p class="error-message">{{ customDomainError() }}</p>
                      }
                      <button
                        class="btn btn-secondary btn-full"
                        (click)="addCustomDomain()"
                        [disabled]="addingCustomDomain() || !customDomainInput"
                      >
                        @if (addingCustomDomain()) {
                          <span class="btn-spinner"></span>
                          Adding...
                        } @else {
                          Add Custom Domain
                        }
                      </button>
                    </div>
                  </div>
                }

                <!-- Success Message -->
                @if (successMessage()) {
                  <div class="success-toast">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    {{ successMessage() }}
                  </div>
                }
              }
            </div>
          </section>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .settings-page {
      min-height: 100vh;
      background: #f5f7fa;
    }

    .main {
      padding: 32px 0;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 0 24px;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
      font-size: 14px;
    }

    .breadcrumb a {
      color: #667eea;
      text-decoration: none;
    }

    .breadcrumb a:hover {
      text-decoration: underline;
    }

    .breadcrumb svg {
      color: #999;
    }

    .breadcrumb span {
      color: #666;
    }

    .page-header {
      margin-bottom: 32px;
    }

    .page-header h1 {
      margin: 0 0 8px 0;
      font-size: 28px;
      color: #1a1a1a;
    }

    .page-description {
      margin: 0;
      color: #666;
      font-size: 15px;
    }

    .card {
      background: white;
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 24px;
      border-bottom: 1px solid #f0f0f0;
    }

    .card-header-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .card-header-text h2 {
      margin: 0 0 4px 0;
      font-size: 18px;
      color: #1a1a1a;
    }

    .card-header-text p {
      margin: 0;
      font-size: 14px;
      color: #666;
    }

    .card-body {
      padding: 24px;
    }

    .loading-state {
      text-align: center;
      padding: 48px 20px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #f0f0f0;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading-state p {
      color: #666;
      margin: 0;
    }

    /* Active Domain Styles */
    .active-domain {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .domain-display {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }

    .domain-url-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .domain-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    .domain-url {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f5f7fa;
      padding: 12px 16px;
      border-radius: 10px;
    }

    .domain-url svg {
      color: #667eea;
      flex-shrink: 0;
    }

    .domain-link {
      font-size: 16px;
      color: #1a1a1a;
      text-decoration: none;
      font-weight: 500;
    }

    .domain-link:hover {
      color: #667eea;
    }

    .copy-btn {
      background: none;
      border: none;
      padding: 6px;
      cursor: pointer;
      color: #666;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .copy-btn:hover {
      background: #e5e7eb;
      color: #1a1a1a;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }

    .status-active {
      background: #dcfce7;
      color: #166534;
    }

    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }

    .status-verified {
      background: #dbeafe;
      color: #1e40af;
    }

    /* DNS Card */
    .dns-card {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 12px;
      padding: 20px;
    }

    .dns-header {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }

    .dns-header svg {
      color: #d97706;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .dns-header h4 {
      margin: 0 0 4px 0;
      font-size: 15px;
      color: #92400e;
    }

    .dns-header p {
      margin: 0;
      font-size: 13px;
      color: #a16207;
    }

    .dns-record {
      background: white;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .dns-field {
      margin-bottom: 12px;
    }

    .dns-field:last-child {
      margin-bottom: 0;
    }

    .dns-label {
      display: block;
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      font-weight: 600;
    }

    .dns-value-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .dns-value {
      background: #f5f7fa;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      color: #1a1a1a;
    }

    .dns-value-long {
      word-break: break-all;
      flex: 1;
    }

    .copy-btn-small {
      background: #e5e7eb;
      border: none;
      padding: 6px;
      cursor: pointer;
      color: #666;
      border-radius: 6px;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .copy-btn-small:hover {
      background: #d1d5db;
      color: #1a1a1a;
    }

    .dns-actions {
      margin-top: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .dns-note {
      font-size: 12px;
      color: #92400e;
      margin: 0;
    }

    .domain-actions {
      padding-top: 16px;
      border-top: 1px solid #f0f0f0;
    }

    /* Domain Options (No domain configured) */
    .domain-options {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .option-card {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 24px;
      transition: all 0.2s;
    }

    .option-card:hover {
      border-color: #667eea;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
    }

    .option-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
    }

    .option-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .option-icon-free {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .option-icon-custom {
      background: #f0f0f0;
      color: #666;
    }

    .option-header h3 {
      margin: 0 0 4px 0;
      font-size: 16px;
      color: #1a1a1a;
    }

    .option-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #dcfce7;
      color: #166534;
      font-size: 11px;
      font-weight: 600;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .option-badge-pro {
      background: #f3e8ff;
      color: #7c3aed;
    }

    .option-description {
      margin: 0 0 20px 0;
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    }

    .subdomain-input-group {
      display: flex;
      align-items: center;
      background: #f5f7fa;
      border-radius: 10px;
      border: 2px solid transparent;
      transition: all 0.2s;
      margin-bottom: 12px;
    }

    .subdomain-input-group:focus-within {
      border-color: #667eea;
      background: white;
    }

    .subdomain-input {
      flex: 1;
      padding: 14px 16px;
      border: none;
      background: transparent;
      font-size: 15px;
      outline: none;
      min-width: 0;
    }

    .subdomain-suffix {
      padding-right: 16px;
      color: #666;
      font-size: 15px;
      white-space: nowrap;
    }

    .preview-url {
      font-size: 13px;
      color: #666;
      margin: 0 0 16px 0;
    }

    .preview-url strong {
      color: #667eea;
    }

    .custom-domain-input-group {
      display: flex;
      align-items: center;
      background: #f5f7fa;
      border-radius: 10px;
      border: 2px solid transparent;
      transition: all 0.2s;
      margin-bottom: 16px;
    }

    .custom-domain-input-group:focus-within {
      border-color: #667eea;
      background: white;
    }

    .protocol-prefix {
      padding-left: 16px;
      color: #666;
      font-size: 15px;
    }

    .custom-domain-input {
      flex: 1;
      padding: 14px 16px 14px 4px;
      border: none;
      background: transparent;
      font-size: 15px;
      outline: none;
      min-width: 0;
    }

    .options-divider {
      display: flex;
      align-items: center;
      gap: 16px;
      color: #999;
      font-size: 13px;
    }

    .options-divider::before,
    .options-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e5e7eb;
    }

    .error-message {
      color: #dc2626;
      font-size: 13px;
      margin: 0 0 16px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .success-toast {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #dcfce7;
      color: #166534;
      padding: 16px;
      border-radius: 10px;
      margin-top: 24px;
      font-weight: 500;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 20px;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-full {
      width: 100%;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .btn-secondary {
      background: #f5f7fa;
      color: #1a1a1a;
      border: 1px solid #e5e7eb;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #e5e7eb;
    }

    .btn-danger-outline {
      background: transparent;
      color: #dc2626;
      border: 1px solid #fecaca;
    }

    .btn-danger-outline:hover:not(:disabled) {
      background: #fef2f2;
      border-color: #dc2626;
    }

    .btn-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .btn-secondary .btn-spinner {
      border-color: rgba(0, 0, 0, 0.1);
      border-top-color: #666;
    }

    @media (max-width: 640px) {
      .domain-display {
        flex-direction: column;
      }

      .option-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .dns-actions {
        flex-direction: column;
        align-items: flex-start;
      }
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

  onSubdomainInput(event: Event) {
    const input = event.target as HTMLInputElement;
    // Only allow lowercase letters, numbers, and hyphens
    this.subdomainInput = input.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
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
