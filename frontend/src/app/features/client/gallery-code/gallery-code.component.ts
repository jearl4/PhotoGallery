import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

/**
 * Gallery Code Entry Component
 * Allows clients to enter their gallery code to access password-protected galleries
 */
@Component({
  selector: 'app-gallery-code',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="code-container">
      <div class="code-card">
        <div class="code-header">
          <div class="gallery-icon">📸</div>
          <h1>Access Gallery</h1>
          <p class="subtitle">Enter your gallery code to view photos</p>
        </div>

        <form [formGroup]="codeForm" (ngSubmit)="onSubmit()" class="code-form">
          <div class="form-group">
            <label for="galleryCode">Gallery Code</label>
            <input
              id="galleryCode"
              type="text"
              formControlName="galleryCode"
              placeholder="e.g., my-wedding-2024"
              class="form-control"
              [class.error]="showError()"
              autofocus>
            @if (showError()) {
              <span class="error-message">
                Gallery code is required
              </span>
            }
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-full"
            [disabled]="!codeForm.valid">
            Continue
          </button>
        </form>

        <div class="info-section">
          <p class="info-text">
            Your photographer should have provided you with a gallery code.
            This is typically a custom URL or code they shared with you.
          </p>
        </div>

        <div class="back-section">
          <a href="/" class="link">← Back to login</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .code-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .code-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 440px;
      width: 100%;
      padding: 48px 40px;
    }

    .code-header {
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

    .code-form {
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

    .back-section {
      margin-top: 24px;
      text-align: center;
    }

    .link {
      color: #667eea;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
    }

    .link:hover {
      text-decoration: underline;
    }

    @media (max-width: 600px) {
      .code-card {
        padding: 36px 24px;
      }
    }
  `]
})
export class GalleryCodeComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  // Gallery code pattern: lowercase letters, numbers, and hyphens only
  private readonly GALLERY_CODE_PATTERN = /^[a-z0-9-]+$/;

  codeForm!: FormGroup;

  ngOnInit(): void {
    this.codeForm = this.fb.group({
      galleryCode: ['', [
        Validators.required,
        Validators.pattern(this.GALLERY_CODE_PATTERN)
      ]]
    });
  }

  /**
   * Handles form submission and navigates to the gallery password page
   */
  onSubmit(): void {
    if (this.codeForm.invalid) {
      return;
    }

    const galleryCode = this.sanitizeGalleryCode(this.codeForm.value.galleryCode);
    this.router.navigate(['/gallery', galleryCode]);
  }

  /**
   * Shows validation error for the gallery code field
   */
  showError(): boolean {
    const codeControl = this.codeForm.get('galleryCode');
    return !!(codeControl?.invalid && codeControl?.touched);
  }

  /**
   * Sanitizes the gallery code by trimming whitespace and converting to lowercase
   */
  private sanitizeGalleryCode(code: string): string {
    return code.trim().toLowerCase();
  }
}
