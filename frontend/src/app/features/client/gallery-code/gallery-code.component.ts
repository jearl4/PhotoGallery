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
  styleUrl: './gallery-code.component.scss'
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
