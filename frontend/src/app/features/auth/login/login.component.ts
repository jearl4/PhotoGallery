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
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .login-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 480px;
      width: 100%;
      overflow: hidden;
    }

    .logo {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }

    .logo h1 {
      margin: 0 0 8px 0;
      font-size: 28px;
      font-weight: 600;
    }

    .tagline {
      margin: 0;
      opacity: 0.9;
      font-size: 14px;
    }

    .login-content {
      padding: 40px 30px;
    }

    h2 {
      margin: 0 0 8px 0;
      font-size: 24px;
      color: #1a1a1a;
    }

    .description {
      margin: 0 0 32px 0;
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    }

    .btn {
      width: 100%;
      padding: 16px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-icon {
      font-size: 20px;
    }

    .features {
      margin-top: 32px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .feature {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #666;
      font-size: 14px;
    }

    .feature-icon {
      width: 20px;
      height: 20px;
      background: #e8f5e9;
      color: #2e7d32;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      flex-shrink: 0;
    }

    .client-access {
      border-top: 1px solid #f0f0f0;
      padding: 24px 30px;
      text-align: center;
      background: #fafafa;
    }

    .client-access p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .link {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
    }

    .link:hover {
      text-decoration: underline;
    }

    @media (max-width: 600px) {
      .login-container {
        padding: 0;
      }

      .login-card {
        border-radius: 0;
        min-height: 100vh;
      }
    }
  `]
})
export class LoginComponent {
  private authService = inject(AuthService);

  login(): void {
    this.authService.login();
  }
}
