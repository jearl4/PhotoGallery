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
  styleUrl: './gallery-access.component.scss'
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
