import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { GalleryFormComponent } from './gallery-form.component';
import { ApiService } from '../../../core/services/api.service';
import { Gallery, CreateGalleryRequest, UpdateGalleryRequest } from '../../../core/models/gallery.model';

describe('GalleryFormComponent', () => {
  let component: GalleryFormComponent;
  let fixture: ComponentFixture<GalleryFormComponent>;
  let mockApiService: jasmine.SpyObj<ApiService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockActivatedRoute: any;

  const mockGallery: Gallery = {
    galleryId: 'gal_123',
    userId: 'user_123',
    name: 'Test Gallery',
    customUrl: 'test-gallery',
    description: 'Test description',
    photoCount: 10,
    clientAccessCount: 5,
    createdAt: '2025-01-01T00:00:00Z',
    status: 'active',
    expiresAt: '2025-12-31T23:59:00Z'
  };

  beforeEach(async () => {
    mockApiService = jasmine.createSpyObj('ApiService', [
      'createGallery',
      'updateGallery',
      'getGallery'
    ]);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: jasmine.createSpy('get').and.returnValue(null)
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [GalleryFormComponent, ReactiveFormsModule],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GalleryFormComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('create mode', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should initialize in create mode when no ID', () => {
      expect(component.isEditMode()).toBe(false);
      expect(component.galleryId).toBeNull();
    });

    it('should display "Create Gallery" title', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const title = compiled.querySelector('h1');
      expect(title?.textContent).toBe('Create Gallery');
    });

    it('should initialize form with empty values', () => {
      expect(component.galleryForm.value).toEqual({
        name: '',
        description: '',
        customUrl: '',
        password: '',
        expiresAt: ''
      });
    });

    it('should require gallery name', () => {
      const nameControl = component.galleryForm.get('name');
      expect(nameControl?.valid).toBe(false);

      nameControl?.setValue('Test Gallery');
      expect(nameControl?.valid).toBe(true);
    });

    it('should require minimum 2 characters for name', () => {
      const nameControl = component.galleryForm.get('name');
      nameControl?.setValue('A');
      expect(nameControl?.valid).toBe(false);

      nameControl?.setValue('AB');
      expect(nameControl?.valid).toBe(true);
    });

    it('should require password', () => {
      const passwordControl = component.galleryForm.get('password');
      expect(passwordControl?.valid).toBe(false);

      passwordControl?.setValue('password123');
      expect(passwordControl?.valid).toBe(true);
    });

    it('should require minimum 6 characters for password', () => {
      const passwordControl = component.galleryForm.get('password');
      passwordControl?.setValue('pass');
      expect(passwordControl?.valid).toBe(false);

      passwordControl?.setValue('pass12');
      expect(passwordControl?.valid).toBe(true);
    });

    it('should validate customUrl pattern', () => {
      const urlControl = component.galleryForm.get('customUrl');

      // Invalid patterns
      urlControl?.setValue('Invalid URL');
      expect(urlControl?.valid).toBe(false);

      urlControl?.setValue('AB');  // Too short
      expect(urlControl?.valid).toBe(false);

      // Valid patterns
      urlControl?.setValue('valid-url-123');
      expect(urlControl?.valid).toBe(true);

      urlControl?.setValue('');  // Optional field
      expect(urlControl?.valid).toBe(true);
    });

    it('should make description optional', () => {
      const descControl = component.galleryForm.get('description');
      expect(descControl?.valid).toBe(true);

      descControl?.setValue('Some description');
      expect(descControl?.valid).toBe(true);
    });

    it('should make expiresAt optional', () => {
      const expiresControl = component.galleryForm.get('expiresAt');
      expect(expiresControl?.valid).toBe(true);
    });

    it('should create gallery on valid form submit', (done) => {
      mockApiService.createGallery.and.returnValue(of(mockGallery));

      component.galleryForm.patchValue({
        name: 'New Gallery',
        description: 'Description',
        customUrl: 'new-gallery',
        password: 'password123',
        expiresAt: '2025-12-31T23:59'
      });

      component.onSubmit();

      setTimeout(() => {
        expect(mockApiService.createGallery).toHaveBeenCalled();
        const request: CreateGalleryRequest = mockApiService.createGallery.calls.argsFor(0)[0];
        expect(request.name).toBe('New Gallery');
        expect(request.customUrl).toBe('new-gallery');
        expect(request.password).toBe('password123');
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/galleries', mockGallery.galleryId]);
        done();
      }, 100);
    });

    it('should not submit invalid form', () => {
      component.galleryForm.patchValue({
        name: '',
        password: ''
      });

      component.onSubmit();

      expect(mockApiService.createGallery).not.toHaveBeenCalled();
    });

    it('should show error message on create failure', (done) => {
      mockApiService.createGallery.and.returnValue(
        throwError(() => ({ error: { message: 'Custom URL already exists' } }))
      );

      component.galleryForm.patchValue({
        name: 'New Gallery',
        password: 'password123'
      });

      component.onSubmit();

      setTimeout(() => {
        expect(component.errorMessage()).toBe('Custom URL already exists');
        expect(component.isSubmitting()).toBe(false);
        done();
      }, 100);
    });

    it('should set submitting state during create', () => {
      mockApiService.createGallery.and.returnValue(of(mockGallery));

      component.galleryForm.patchValue({
        name: 'Gallery',
        password: 'password123'
      });

      expect(component.isSubmitting()).toBe(false);
      component.onSubmit();
      expect(component.isSubmitting()).toBe(true);
    });

    it('should navigate back to dashboard on cancel from create', () => {
      component.goBack();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/dashboard']);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => {
      mockActivatedRoute.snapshot.paramMap.get.and.returnValue('gal_123');
      mockApiService.getGallery.and.returnValue(of(mockGallery));
      fixture.detectChanges();
    });

    it('should initialize in edit mode when ID present', () => {
      expect(component.isEditMode()).toBe(true);
      expect(component.galleryId).toBe('gal_123');
    });

    it('should display "Edit Gallery" title', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const title = compiled.querySelector('h1');
      expect(title?.textContent).toBe('Edit Gallery');
    });

    it('should load existing gallery data', (done) => {
      setTimeout(() => {
        expect(mockApiService.getGallery).toHaveBeenCalledWith('gal_123');
        expect(component.galleryForm.value.name).toBe('Test Gallery');
        expect(component.galleryForm.value.customUrl).toBe('test-gallery');
        expect(component.galleryForm.value.description).toBe('Test description');
        done();
      }, 100);
    });

    it('should not populate password on edit', (done) => {
      setTimeout(() => {
        expect(component.galleryForm.value.password).toBe('');
        done();
      }, 100);
    });

    it('should format date for datetime-local input', (done) => {
      setTimeout(() => {
        expect(component.galleryForm.value.expiresAt).toBe('2025-12-31T23:59');
        done();
      }, 100);
    });

    it('should update gallery on submit', (done) => {
      mockApiService.updateGallery.and.returnValue(of(mockGallery));

      setTimeout(() => {
        component.galleryForm.patchValue({
          name: 'Updated Gallery',
          description: 'Updated description'
        });

        component.onSubmit();

        setTimeout(() => {
          expect(mockApiService.updateGallery).toHaveBeenCalledWith('gal_123', jasmine.any(Object));
          const request: UpdateGalleryRequest = mockApiService.updateGallery.calls.argsFor(0)[1];
          expect(request.name).toBe('Updated Gallery');
          expect(request.description).toBe('Updated description');
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/galleries', mockGallery.galleryId]);
          done();
        }, 100);
      }, 100);
    });

    it('should include password in update if changed', (done) => {
      mockApiService.updateGallery.and.returnValue(of(mockGallery));

      setTimeout(() => {
        component.galleryForm.patchValue({
          password: 'newpassword123'
        });

        component.onSubmit();

        setTimeout(() => {
          const request: UpdateGalleryRequest = mockApiService.updateGallery.calls.argsFor(0)[1];
          expect(request.password).toBe('newpassword123');
          done();
        }, 100);
      }, 100);
    });

    it('should show error on load failure', (done) => {
      mockApiService.getGallery.and.returnValue(
        throwError(() => new Error('Not found'))
      );

      const newComponent = new GalleryFormComponent();
      (newComponent as any).galleryId = 'gal_123';

      setTimeout(() => {
        expect(newComponent.errorMessage()).toBe('Failed to load gallery');
        done();
      }, 100);
    });

    it('should navigate back to gallery detail on cancel from edit', (done) => {
      setTimeout(() => {
        component.goBack();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/galleries', 'gal_123']);
        done();
      }, 100);
    });
  });

  describe('form validation UI', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should mark field invalid when dirty and invalid', () => {
      const nameControl = component.galleryForm.get('name')!;
      nameControl.markAsDirty();
      nameControl.setValue('');

      expect(component.isFieldInvalid('name')).toBe(true);
    });

    it('should not mark field invalid when pristine', () => {
      const nameControl = component.galleryForm.get('name')!;
      nameControl.setValue('');

      expect(component.isFieldInvalid('name')).toBe(false);
    });

    it('should display URL prefix in template', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const urlPrefix = compiled.querySelector('.url-prefix');
      expect(urlPrefix?.textContent).toContain('/gallery/');
    });

    it('should disable submit button when form invalid', () => {
      component.galleryForm.patchValue({
        name: '',
        password: ''
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const submitBtn = compiled.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(true);
    });

    it('should disable submit button when submitting', () => {
      component.isSubmitting.set(true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const submitBtn = compiled.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(true);
    });

    it('should show error message when present', () => {
      component.errorMessage.set('Test error message');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const errorAlert = compiled.querySelector('.alert-error');
      expect(errorAlert).toBeTruthy();
      expect(errorAlert?.textContent).toContain('Test error message');
    });
  });

  describe('date handling', () => {
    it('should format ISO date for input', () => {
      const isoDate = '2025-12-31T23:59:00Z';
      const formatted = component['formatDateForInput'](isoDate);
      expect(formatted).toBe('2025-12-31T23:59');
    });

    it('should convert form date to ISO string', (done) => {
      mockApiService.createGallery.and.returnValue(of(mockGallery));

      component.galleryForm.patchValue({
        name: 'Gallery',
        password: 'password123',
        expiresAt: '2025-12-31T23:59'
      });

      component.onSubmit();

      setTimeout(() => {
        const request: CreateGalleryRequest = mockApiService.createGallery.calls.argsFor(0)[0];
        expect(request.expiresAt).toBeTruthy();
        expect(request.expiresAt).toContain('2025-12-31');
        done();
      }, 100);
    });
  });
});
