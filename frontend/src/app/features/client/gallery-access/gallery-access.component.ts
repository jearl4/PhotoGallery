import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientSessionService } from '../../../core/services/client-session.service';

/**
 * Gallery Access Component
 * Password entry page for accessing password-protected galleries
 */
@Component({
  selector: 'app-gallery-access',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="access-container">
      <div class="access-card">
        <div class="access-header">
          <div class="gallery-icon">🔒</div>
          <h1>Private Gallery</h1>
          <p class="subtitle">Enter the password to view this gallery</p>
        </div>

        <form [formGroup]="accessForm" (ngSubmit)="onSubmit()" class="access-form">
          <div class="form-group">
            <label for="password">Gallery Password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="Enter password"
              class="form-control"
              [class.error]="showError()"
              autofocus>
            @if (showError()) {
              <span class="error-message">
                {{ errorMessage() || 'Password is required' }}
              </span>
            }
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-full"
            [disabled]="!accessForm.valid || isSubmitting()">
            @if (isSubmitting()) {
              <span class="spinner"></span>
              Verifying...
            } @else {
              Access Gallery
            }
          </button>
        </form>

        <div class="info-section">
          <p class="info-text">
            This is a password-protected gallery. Contact the photographer
            if you don't have the password.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .access-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .access-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 440px;
      width: 100%;
      padding: 48px 40px;
    }

    .access-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .gallery-icon {
      font-size: 56px;
      margin-bottom: 16px;
    }

    h1 {
      margin: 0 0 8px 0;
      font-size: 28px;
      color: #1a1a1a;
    }

    .subtitle {
      margin: 0;
      font-size: 14px;
      color: #666;
    }

    .access-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    label {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
    }

    .form-control {
      padding: 14px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 15px;
      transition: all 0.2s;
      font-family: inherit;
    }

    .form-control:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-control.error {
      border-color: #ef4444;
    }

    .form-control.error:focus {
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    .error-message {
      font-size: 13px;
      color: #ef4444;
    }

    .btn {
      padding: 14px 24px;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-full {
      width: 100%;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .info-section {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #f0f0f0;
    }

    .info-text {
      margin: 0;
      font-size: 13px;
      color: #666;
      text-align: center;
      line-height: 1.5;
    }

    @media (max-width: 600px) {
      .access-card {
        padding: 36px 24px;
      }
    }
  `]
})
export class GalleryAccessComponent implements OnInit {
  private fb = inject(FormBuilder);
  private sessionService = inject(ClientSessionService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  accessForm!: FormGroup;
  customUrl: string = '';
  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.customUrl = this.route.snapshot.paramMap.get('customUrl') || '';

    // Check if already has session for this gallery
    if (this.sessionService.getSessionForGallery(this.customUrl)) {
      this.navigateToGallery();
      return;
    }

    this.accessForm = this.fb.group({
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.accessForm.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const password = this.accessForm.value.password;

    this.sessionService.verifyPassword(this.customUrl, password).subscribe({
      next: () => {
        this.navigateToGallery();
      },
      error: (err) => {
        console.error('Password verification failed:', err);
        let message = 'Invalid password. Please try again.';

        if (err.status === 404) {
          message = 'Gallery not found. Please check the URL.';
        } else if (err.status === 401) {
          message = 'Invalid password. Please try again.';
        } else if (err.error?.error) {
          message = err.error.error;
        } else if (err.error?.message) {
          message = err.error.message;
        }

        this.errorMessage.set(message);
        this.isSubmitting.set(false);
        this.accessForm.patchValue({ password: '' });
      }
    });
  }

  showError(): boolean {
    const passwordControl = this.accessForm.get('password');
    return !!(
      (passwordControl?.invalid && passwordControl?.touched) ||
      this.errorMessage()
    );
  }

  private navigateToGallery(): void {
    this.router.navigate(['/gallery', this.customUrl, 'view']);
  }
}
