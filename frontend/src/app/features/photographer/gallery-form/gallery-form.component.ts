import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { Gallery, CreateGalleryRequest, UpdateGalleryRequest } from '../../../core/models/gallery.model';

@Component({
  selector: 'app-gallery-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="form-page">
      <div class="form-container">
        <div class="form-header">
          <button class="btn-back" (click)="goBack()">
            ← Back
          </button>
          <h1>{{ isEditMode() ? 'Edit Gallery' : 'Create Gallery' }}</h1>
        </div>

        <form [formGroup]="galleryForm" (ngSubmit)="onSubmit()" class="form">
          <!-- Gallery Name -->
          <div class="form-group">
            <label for="name">Gallery Name *</label>
            <input
              id="name"
              type="text"
              formControlName="name"
              placeholder="e.g., John & Jane Wedding"
              class="form-control"
              [class.error]="isFieldInvalid('name')">
            @if (isFieldInvalid('name')) {
              <span class="error-message">Gallery name is required</span>
            }
          </div>

          <!-- Description -->
          <div class="form-group">
            <label for="description">Description</label>
            <textarea
              id="description"
              formControlName="description"
              placeholder="Add details about this gallery..."
              rows="3"
              class="form-control"></textarea>
          </div>

          <!-- Custom URL -->
          <div class="form-group">
            <label for="customUrl">Custom URL</label>
            <div class="url-input-group">
              <span class="url-prefix">{{ urlPrefix }}/</span>
              <input
                id="customUrl"
                type="text"
                formControlName="customUrl"
                placeholder="auto-generated"
                class="form-control url-input"
                [class.error]="isFieldInvalid('customUrl')">
            </div>
            @if (isFieldInvalid('customUrl')) {
              <span class="error-message">
                URL must be 3-100 characters, lowercase letters, numbers, and hyphens only
              </span>
            }
            <span class="help-text">
              Leave blank for auto-generated URL. Use only lowercase letters, numbers, and hyphens.
            </span>
          </div>

          <!-- Password -->
          <div class="form-group">
            <label for="password">Gallery Password *</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="Enter password for client access"
              class="form-control"
              [class.error]="isFieldInvalid('password')">
            @if (isFieldInvalid('password')) {
              <span class="error-message">Password is required (min 6 characters)</span>
            }
            <span class="help-text">
              Clients will need this password to access the gallery
            </span>
          </div>

          <!-- Expiration Date -->
          <div class="form-group">
            <label for="expiresAt">Expiration Date (Optional)</label>
            <input
              id="expiresAt"
              type="datetime-local"
              formControlName="expiresAt"
              class="form-control">
            <span class="help-text">
              Gallery will automatically expire on this date
            </span>
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <button
              type="button"
              class="btn btn-secondary"
              (click)="goBack()"
              [disabled]="isSubmitting()">
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              [disabled]="!galleryForm.valid || isSubmitting()">
              @if (isSubmitting()) {
                <span class="spinner-small"></span>
                Saving...
              } @else {
                {{ isEditMode() ? 'Update Gallery' : 'Create Gallery' }}
              }
            </button>
          </div>

          <!-- Error Message -->
          @if (errorMessage()) {
            <div class="alert alert-error">
              {{ errorMessage() }}
            </div>
          }
        </form>
      </div>
    </div>
  `,
  styles: [`
    .form-page {
      min-height: 100vh;
      background: #f5f7fa;
      padding: 40px 20px;
    }

    .form-container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .form-header {
      margin-bottom: 32px;
    }

    .btn-back {
      background: none;
      border: none;
      color: #667eea;
      font-size: 14px;
      cursor: pointer;
      padding: 0;
      margin-bottom: 16px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .btn-back:hover {
      text-decoration: underline;
    }

    h1 {
      margin: 0;
      font-size: 28px;
      color: #1a1a1a;
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: 24px;
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
      padding: 12px 16px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
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

    textarea.form-control {
      resize: vertical;
      min-height: 80px;
    }

    .url-input-group {
      display: flex;
      align-items: stretch;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      transition: all 0.2s;
    }

    .url-input-group:focus-within {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .url-prefix {
      background: #f5f7fa;
      padding: 12px 16px;
      font-size: 14px;
      color: #666;
      border-right: 1px solid #e5e7eb;
      white-space: nowrap;
    }

    .url-input {
      border: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      flex: 1;
    }

    .error-message {
      font-size: 13px;
      color: #ef4444;
    }

    .help-text {
      font-size: 13px;
      color: #666;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }

    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #667eea;
      color: white;
      flex: 1;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5568d3;
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: #f5f7fa;
      color: #666;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #e5e7eb;
    }

    .spinner-small {
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

    .alert {
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-top: 16px;
    }

    .alert-error {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    @media (max-width: 640px) {
      .form-container {
        padding: 24px;
      }

      .form-actions {
        flex-direction: column-reverse;
      }

      .btn-primary {
        width: 100%;
      }
    }
  `]
})
export class GalleryFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  galleryForm!: FormGroup;
  isEditMode = signal(false);
  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);
  galleryId: string | null = null;
  urlPrefix = `${window.location.origin}/gallery`;

  ngOnInit(): void {
    this.galleryId = this.route.snapshot.paramMap.get('id');
    this.isEditMode.set(!!this.galleryId);

    this.initForm();

    if (this.isEditMode()) {
      this.loadGallery();
    }
  }

  private initForm(): void {
    this.galleryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      customUrl: ['', [
        Validators.pattern(/^[a-z0-9-]*$/),
        Validators.minLength(3),
        Validators.maxLength(100)
      ]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      expiresAt: ['']
    });
  }

  private loadGallery(): void {
    if (!this.galleryId) return;

    this.apiService.getGallery(this.galleryId).subscribe({
      next: (gallery) => {
        this.galleryForm.patchValue({
          name: gallery.name,
          description: gallery.description,
          customUrl: gallery.customUrl,
          expiresAt: gallery.expiresAt ? this.formatDateForInput(gallery.expiresAt) : ''
        });
        // Don't populate password on edit
      },
      error: (err) => {
        console.error('Failed to load gallery:', err);
        this.errorMessage.set('Failed to load gallery');
      }
    });
  }

  onSubmit(): void {
    if (this.galleryForm.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.galleryForm.value;

    if (this.isEditMode()) {
      this.updateGallery(formValue);
    } else {
      this.createGallery(formValue);
    }
  }

  private createGallery(formValue: any): void {
    const request: CreateGalleryRequest = {
      name: formValue.name,
      description: formValue.description || undefined,
      customUrl: formValue.customUrl || undefined,
      password: formValue.password,
      expiresAt: formValue.expiresAt ? new Date(formValue.expiresAt).toISOString() : undefined
    };

    this.apiService.createGallery(request).subscribe({
      next: (gallery) => {
        this.router.navigate(['/photographer/galleries', gallery.galleryId]);
      },
      error: (err) => {
        console.error('Failed to create gallery:', err);
        this.errorMessage.set(
          err.error?.message || 'Failed to create gallery. Please try again.'
        );
        this.isSubmitting.set(false);
      }
    });
  }

  private updateGallery(formValue: any): void {
    if (!this.galleryId) return;

    const request: UpdateGalleryRequest = {
      name: formValue.name,
      description: formValue.description || undefined,
      expiresAt: formValue.expiresAt ? new Date(formValue.expiresAt).toISOString() : undefined
    };

    // Only include password if it was changed
    if (formValue.password) {
      request.password = formValue.password;
    }

    this.apiService.updateGallery(this.galleryId, request).subscribe({
      next: (gallery) => {
        this.router.navigate(['/photographer/galleries', gallery.galleryId]);
      },
      error: (err) => {
        console.error('Failed to update gallery:', err);
        this.errorMessage.set(
          err.error?.message || 'Failed to update gallery. Please try again.'
        );
        this.isSubmitting.set(false);
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.galleryForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  goBack(): void {
    if (this.galleryId) {
      this.router.navigate(['/photographer/galleries', this.galleryId]);
    } else {
      this.router.navigate(['/photographer/dashboard']);
    }
  }

  private formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
  }
}
