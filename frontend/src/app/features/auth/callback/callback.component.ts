import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-container">
      <div class="callback-card">
        @if (error) {
          <div class="error-state">
            <div class="error-icon">✕</div>
            <h2>Authentication Failed</h2>
            <p>{{ error }}</p>
            <button class="btn btn-primary" (click)="retry()">
              Try Again
            </button>
          </div>
        } @else {
          <div class="loading-state">
            <div class="spinner"></div>
            <h2>Signing you in...</h2>
            <p>Please wait while we complete your authentication</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .callback-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .callback-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 480px;
      width: 100%;
      padding: 60px 40px;
      text-align: center;
    }

    .loading-state,
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #f0f0f0;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-icon {
      width: 64px;
      height: 64px;
      background: #ffebee;
      color: #c62828;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: bold;
    }

    h2 {
      margin: 0;
      font-size: 24px;
      color: #1a1a1a;
    }

    p {
      margin: 0;
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    }

    .btn {
      padding: 12px 32px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 12px;
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
  `]
})
export class CallbackComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  error: string | null = null;

  ngOnInit(): void {
    // Get authorization code from query params
    const code = this.route.snapshot.queryParamMap.get('code');
    const errorParam = this.route.snapshot.queryParamMap.get('error');

    if (errorParam) {
      this.error = 'Authorization was denied or cancelled';
      return;
    }

    if (!code) {
      this.error = 'No authorization code received';
      return;
    }

    // Exchange code for tokens
    this.authService.handleCallback(code).subscribe({
      next: (success) => {
        if (success) {
          // Redirect to dashboard
          this.router.navigate(['/photographer/dashboard']);
        } else {
          this.error = 'Failed to complete authentication';
        }
      },
      error: (err) => {
        console.error('Callback error:', err);
        this.error = err.error?.message || 'An error occurred during authentication';
      }
    });
  }

  retry(): void {
    this.router.navigate(['/']);
  }
}
