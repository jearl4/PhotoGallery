import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="header">
      <div class="header-content">
        <a routerLink="/photographer/dashboard" class="logo">
          <span class="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
          </span>
          <span class="logo-text">Gallery</span>
        </a>

        <nav class="nav">
          <a routerLink="/photographer/dashboard" routerLinkActive="active" class="nav-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            Galleries
          </a>
          <a routerLink="/photographer/analytics" routerLinkActive="active" class="nav-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Analytics
          </a>
        </nav>

        <div class="header-right">
          <!-- User Menu -->
          <div class="user-menu" (click)="toggleMenu($event)">
            <div class="user-avatar">
              @if (user$ | async; as user) {
                {{ getInitials(user.email) }}
              }
            </div>
            <div class="user-info">
              @if (user$ | async; as user) {
                <span class="user-name">{{ getUserName(user.email) }}</span>
                <span class="user-email">{{ user.email }}</span>
              }
            </div>
            <svg class="chevron" [class.open]="menuOpen()" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>

            <!-- Dropdown Menu -->
            @if (menuOpen()) {
              <div class="dropdown-menu" (click)="$event.stopPropagation()">
                <div class="dropdown-header">
                  <div class="dropdown-avatar">
                    @if (user$ | async; as user) {
                      {{ getInitials(user.email) }}
                    }
                  </div>
                  <div class="dropdown-user-info">
                    @if (user$ | async; as user) {
                      <span class="dropdown-user-name">{{ getUserName(user.email) }}</span>
                      <span class="dropdown-user-email">{{ user.email }}</span>
                    }
                  </div>
                </div>

                <div class="dropdown-divider"></div>

                <a routerLink="/photographer/settings" class="dropdown-item" (click)="closeMenu()">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  <div class="dropdown-item-content">
                    <span class="dropdown-item-title">Settings</span>
                    <span class="dropdown-item-description">Custom domain, profile</span>
                  </div>
                </a>

                <div class="dropdown-divider"></div>

                <button class="dropdown-item dropdown-item-danger" (click)="logout()">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    </header>

    <!-- Click outside to close -->
    @if (menuOpen()) {
      <div class="backdrop" (click)="closeMenu()"></div>
    }
  `,
  styles: [`
    .header {
      background: white;
      border-bottom: 1px solid #e5e7eb;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
      height: 64px;
      display: flex;
      align-items: center;
      gap: 32px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: #1a1a1a;
      font-weight: 700;
      font-size: 18px;
    }

    .logo-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 10px;
      color: white;
    }

    .nav {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      text-decoration: none;
      color: #666;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .nav-link:hover {
      background: #f5f7fa;
      color: #1a1a1a;
    }

    .nav-link.active {
      background: #f0f3ff;
      color: #667eea;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .user-menu {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px 6px 6px;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }

    .user-menu:hover {
      background: #f5f7fa;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .user-info {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
      line-height: 1.3;
    }

    .user-email {
      font-size: 12px;
      color: #666;
      line-height: 1.3;
    }

    .chevron {
      color: #666;
      transition: transform 0.2s;
    }

    .chevron.open {
      transform: rotate(180deg);
    }

    .dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 280px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      z-index: 1000;
      animation: dropdownIn 0.15s ease-out;
    }

    @keyframes dropdownIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dropdown-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
    }

    .dropdown-avatar {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .dropdown-user-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .dropdown-user-name {
      font-size: 15px;
      font-weight: 600;
      color: #1a1a1a;
    }

    .dropdown-user-email {
      font-size: 13px;
      color: #666;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dropdown-divider {
      height: 1px;
      background: #e5e7eb;
      margin: 0;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      text-decoration: none;
      color: #1a1a1a;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.15s;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
    }

    .dropdown-item:hover {
      background: #f5f7fa;
    }

    .dropdown-item svg {
      color: #666;
      flex-shrink: 0;
    }

    .dropdown-item-content {
      display: flex;
      flex-direction: column;
    }

    .dropdown-item-title {
      font-weight: 500;
    }

    .dropdown-item-description {
      font-size: 12px;
      color: #666;
      margin-top: 2px;
    }

    .dropdown-item-danger {
      color: #dc2626;
    }

    .dropdown-item-danger:hover {
      background: #fef2f2;
    }

    .dropdown-item-danger svg {
      color: #dc2626;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 50;
    }

    @media (max-width: 768px) {
      .user-info {
        display: none;
      }

      .header-content {
        gap: 16px;
      }

      .logo-text {
        display: none;
      }
    }
  `]
})
export class HeaderComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  user$ = this.authService.currentUser$;
  menuOpen = signal(false);

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update(v => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  logout(): void {
    this.closeMenu();
    this.authService.logout();
  }

  getInitials(email: string | undefined): string {
    if (!email) return '?';
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  }

  getUserName(email: string | undefined): string {
    if (!email) return 'User';
    return email.split('@')[0];
  }
}
