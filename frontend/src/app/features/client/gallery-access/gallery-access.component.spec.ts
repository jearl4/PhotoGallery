import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { GalleryAccessComponent } from './gallery-access.component';
import { ClientSessionService } from '../../../core/services/client-session.service';

describe('GalleryAccessComponent', () => {
  let component: GalleryAccessComponent;
  let fixture: ComponentFixture<GalleryAccessComponent>;
  let mockSessionService: jasmine.SpyObj<ClientSessionService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockActivatedRoute: any;

  beforeEach(async () => {
    mockSessionService = jasmine.createSpyObj('ClientSessionService', [
      'verifyPassword',
      'getSessionForGallery'
    ]);

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: jasmine.createSpy('get').and.returnValue('test-gallery')
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [GalleryAccessComponent, ReactiveFormsModule],
      providers: [
        { provide: ClientSessionService, useValue: mockSessionService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GalleryAccessComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should initialize form with password field', () => {
      mockSessionService.getSessionForGallery.and.returnValue(null);
      fixture.detectChanges();

      expect(component.accessForm).toBeDefined();
      expect(component.accessForm.get('password')).toBeDefined();
    });

    it('should load customUrl from route params', () => {
      mockSessionService.getSessionForGallery.and.returnValue(null);
      fixture.detectChanges();

      expect(component.customUrl).toBe('test-gallery');
      expect(mockActivatedRoute.snapshot.paramMap.get).toHaveBeenCalledWith('customUrl');
    });

    it('should navigate to gallery if session already exists', () => {
      const mockSession = {
        sessionToken: 'token',
        gallery: {} as any,
        customUrl: 'test-gallery'
      };
      mockSessionService.getSessionForGallery.and.returnValue(mockSession);

      fixture.detectChanges();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/gallery', 'test-gallery', 'view']);
    });
  });

  describe('form validation', () => {
    beforeEach(() => {
      mockSessionService.getSessionForGallery.and.returnValue(null);
      fixture.detectChanges();
    });

    it('should be invalid when password is empty', () => {
      expect(component.accessForm.valid).toBe(false);
    });

    it('should be valid when password is provided', () => {
      component.accessForm.patchValue({ password: 'test123' });
      expect(component.accessForm.valid).toBe(true);
    });
  });

  describe('onSubmit', () => {
    beforeEach(() => {
      mockSessionService.getSessionForGallery.and.returnValue(null);
      fixture.detectChanges();
    });

    it('should not submit if form is invalid', () => {
      component.accessForm.patchValue({ password: '' });
      component.onSubmit();

      expect(mockSessionService.verifyPassword).not.toHaveBeenCalled();
    });

    it('should not submit if already submitting', () => {
      component.accessForm.patchValue({ password: 'test123' });
      component.isSubmitting.set(true);

      component.onSubmit();

      expect(mockSessionService.verifyPassword).not.toHaveBeenCalled();
    });

    it('should verify password with correct parameters', () => {
      const mockResponse = {
        sessionToken: 'token',
        gallery: {} as any
      };
      mockSessionService.verifyPassword.and.returnValue(of(mockResponse));

      component.accessForm.patchValue({ password: 'password123' });
      component.onSubmit();

      expect(mockSessionService.verifyPassword).toHaveBeenCalledWith('test-gallery', 'password123');
    });

    it('should set isSubmitting to true during verification', () => {
      const mockResponse = {
        sessionToken: 'token',
        gallery: {} as any
      };
      mockSessionService.verifyPassword.and.returnValue(of(mockResponse));

      component.accessForm.patchValue({ password: 'password123' });
      expect(component.isSubmitting()).toBe(false);

      component.onSubmit();

      expect(component.isSubmitting()).toBe(true);
    });

    it('should navigate to gallery on successful verification', () => {
      const mockResponse = {
        sessionToken: 'token',
        gallery: {} as any
      };
      mockSessionService.verifyPassword.and.returnValue(of(mockResponse));

      component.accessForm.patchValue({ password: 'password123' });
      component.onSubmit();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/gallery', 'test-gallery', 'view']);
    });

    it('should clear error message on submit', () => {
      const mockResponse = {
        sessionToken: 'token',
        gallery: {} as any
      };
      mockSessionService.verifyPassword.and.returnValue(of(mockResponse));

      component.errorMessage.set('Previous error');
      component.accessForm.patchValue({ password: 'password123' });
      component.onSubmit();

      expect(component.errorMessage()).toBeNull();
    });

    it('should handle verification error', () => {
      const error = { error: { message: 'Invalid password' } };
      mockSessionService.verifyPassword.and.returnValue(throwError(() => error));

      component.accessForm.patchValue({ password: 'wrong' });
      component.onSubmit();

      expect(component.errorMessage()).toBe('Invalid password');
      expect(component.isSubmitting()).toBe(false);
    });

    it('should use default error message if none provided', () => {
      mockSessionService.verifyPassword.and.returnValue(throwError(() => ({})));

      component.accessForm.patchValue({ password: 'wrong' });
      component.onSubmit();

      expect(component.errorMessage()).toBe('Invalid password. Please try again.');
    });

    it('should clear password field on error', () => {
      mockSessionService.verifyPassword.and.returnValue(throwError(() => ({})));

      component.accessForm.patchValue({ password: 'wrong' });
      component.onSubmit();

      expect(component.accessForm.value.password).toBe('');
    });
  });

  describe('showError', () => {
    beforeEach(() => {
      mockSessionService.getSessionForGallery.and.returnValue(null);
      fixture.detectChanges();
    });

    it('should return false initially', () => {
      expect(component.showError()).toBe(false);
    });

    it('should return true when field is touched and invalid', () => {
      const passwordControl = component.accessForm.get('password');
      passwordControl?.markAsTouched();

      expect(component.showError()).toBe(true);
    });

    it('should return true when error message is set', () => {
      component.errorMessage.set('Test error');

      expect(component.showError()).toBe(true);
    });

    it('should return false when field is valid', () => {
      component.accessForm.patchValue({ password: 'test123' });

      expect(component.showError()).toBe(false);
    });
  });

  describe('template integration', () => {
    beforeEach(() => {
      mockSessionService.getSessionForGallery.and.returnValue(null);
      fixture.detectChanges();
    });

    it('should render password input', () => {
      const input = fixture.nativeElement.querySelector('input[type="password"]');
      expect(input).toBeTruthy();
    });

    it('should render submit button', () => {
      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button).toBeTruthy();
      expect(button.textContent.trim()).toContain('Access Gallery');
    });

    it('should disable submit button when form is invalid', () => {
      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.disabled).toBe(true);
    });

    it('should enable submit button when form is valid', () => {
      component.accessForm.patchValue({ password: 'test123' });
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.disabled).toBe(false);
    });

    it('should show spinner when submitting', () => {
      component.isSubmitting.set(true);
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('.spinner');
      expect(spinner).toBeTruthy();
    });

    it('should show error message when present', () => {
      component.errorMessage.set('Test error message');
      fixture.detectChanges();

      const errorEl = fixture.nativeElement.querySelector('.error-message');
      expect(errorEl).toBeTruthy();
      expect(errorEl.textContent).toContain('Test error message');
    });
  });
});
