import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="logo">
          <h1>Photographer Gallery</h1>
          <p class="tagline">Share your work beautifully</p>
        </div>

        <div class="login-content">
          <h2>Photographer Login</h2>
          <p class="description">
            Sign in to manage your galleries and share photos with clients
          </p>

          <button
            class="btn btn-primary btn-login"
            (click)="login()"
            type="button">
            <span class="btn-icon">→</span>
            Sign in with Social Login
          </button>

          <div class="features">
            <div class="feature">
              <span class="feature-icon">✓</span>
              <span>Secure OAuth authentication</span>
            </div>
            <div class="feature">
              <span class="feature-icon">✓</span>
              <span>Password-protected galleries</span>
            </div>
            <div class="feature">
              <span class="feature-icon">✓</span>
              <span>Client photo favorites</span>
            </div>
          </div>
        </div>

        <div class="client-access">
          <p>
            Have a gallery code?
            <a href="/client/access" class="link">Access gallery →</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private authService = inject(AuthService);

  login(): void {
    this.authService.login();
  }
}
