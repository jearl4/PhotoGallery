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
  templateUrl: './gallery-form.component.html',
  styleUrl: './gallery-form.component.scss'
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
      password: ['', this.isEditMode() ? [] : [Validators.required, Validators.minLength(6)]],
      expiresAt: [''],
      enableWatermark: [false],
      watermarkText: [''],
      watermarkPosition: ['bottom-right']
    });

    // Add conditional validation for watermark text
    this.galleryForm.get('enableWatermark')?.valueChanges.subscribe(enabled => {
      const watermarkTextControl = this.galleryForm.get('watermarkText');
      if (enabled) {
        watermarkTextControl?.setValidators([Validators.required, Validators.minLength(1)]);
      } else {
        watermarkTextControl?.clearValidators();
      }
      watermarkTextControl?.updateValueAndValidity();
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
          expiresAt: gallery.expiresAt ? this.formatDateForInput(gallery.expiresAt) : '',
          enableWatermark: gallery.enableWatermark === true || gallery.enableWatermark === false ? gallery.enableWatermark : false,
          watermarkText: gallery.watermarkText ?? '',
          watermarkPosition: gallery.watermarkPosition ?? 'bottom-right'
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
      expiresAt: formValue.expiresAt ? this.formatDateToISO(formValue.expiresAt) : undefined,
      enableWatermark: formValue.enableWatermark || false,
      watermarkText: formValue.enableWatermark ? formValue.watermarkText : undefined,
      watermarkPosition: formValue.enableWatermark ? formValue.watermarkPosition : undefined
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
      expiresAt: formValue.expiresAt ? this.formatDateToISO(formValue.expiresAt) : undefined,
      enableWatermark: formValue.enableWatermark || false,
      watermarkText: formValue.enableWatermark ? formValue.watermarkText : undefined,
      watermarkPosition: formValue.enableWatermark ? formValue.watermarkPosition : undefined
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
    // Format ISO date string to YYYY-MM-DD for date input
    const date = new Date(dateString);
    return date.toISOString().slice(0, 10);
  }

  private formatDateToISO(dateString: string): string {
    // Convert YYYY-MM-DD to end of day (23:59:59) in user's local timezone
    // This makes the expiration intuitive - gallery expires at midnight on the selected date
    const date = new Date(dateString + 'T23:59:59');
    return date.toISOString();
  }

  getMinDate(): string {
    // Set minimum date to today (users can set expiration for end of today if they want)
    const today = new Date();
    return today.toISOString().slice(0, 10);
  }
}
