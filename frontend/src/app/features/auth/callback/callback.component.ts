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
  styleUrl: './callback.component.scss'
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
