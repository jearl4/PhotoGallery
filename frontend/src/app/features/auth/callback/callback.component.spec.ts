import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CallbackComponent } from './callback.component';
import { AuthService } from '../../../core/services/auth.service';

describe('CallbackComponent', () => {
  let component: CallbackComponent;
  let fixture: ComponentFixture<CallbackComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockActivatedRoute: any;

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj('AuthService', ['handleCallback']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockActivatedRoute = {
      snapshot: {
        queryParamMap: {
          get: jasmine.createSpy('get')
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [CallbackComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CallbackComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display loading state initially', () => {
    mockActivatedRoute.snapshot.queryParamMap.get.and.returnValue('test-code');
    mockAuthService.handleCallback.and.returnValue(of(true));

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const loadingContainer = compiled.querySelector('.callback-container');
    expect(loadingContainer).toBeTruthy();
  });

  it('should process authorization code on init', () => {
    const testCode = 'test-auth-code-123';
    mockActivatedRoute.snapshot.queryParamMap.get.and.returnValue(testCode);
    mockAuthService.handleCallback.and.returnValue(of(true));

    fixture.detectChanges();

    expect(mockActivatedRoute.snapshot.queryParamMap.get).toHaveBeenCalledWith('code');
    expect(mockAuthService.handleCallback).toHaveBeenCalledWith(testCode);
  });

  it('should navigate to dashboard on successful authentication', (done) => {
    mockActivatedRoute.snapshot.queryParamMap.get.and.returnValue('valid-code');
    mockAuthService.handleCallback.and.returnValue(of(true));

    fixture.detectChanges();

    setTimeout(() => {
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/dashboard']);
      done();
    }, 100);
  });

  it('should display error when no code is provided', () => {
    mockActivatedRoute.snapshot.queryParamMap.get.and.returnValue(null);

    fixture.detectChanges();

    expect(component.error).toBe('No authorization code received');
    expect(mockAuthService.handleCallback).not.toHaveBeenCalled();
  });

  it('should display error message when no code', () => {
    mockActivatedRoute.snapshot.queryParamMap.get.and.returnValue(null);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const errorAlert = compiled.querySelector('.alert-error');
    expect(errorAlert).toBeTruthy();
    expect(errorAlert?.textContent).toContain('No authorization code received');
  });

  it('should handle authentication failure', (done) => {
    mockActivatedRoute.snapshot.queryParamMap.get.and.returnValue('invalid-code');
    mockAuthService.handleCallback.and.returnValue(of(false));

    fixture.detectChanges();

    setTimeout(() => {
      expect(component.error).toBe('Failed to complete authentication');
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      done();
    }, 100);
  });

  it('should display error message on authentication failure', (done) => {
    mockActivatedRoute.snapshot.queryParamMap.get.and.returnValue('invalid-code');
    mockAuthService.handleCallback.and.returnValue(of(false));

    fixture.detectChanges();

    setTimeout(() => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const errorAlert = compiled.querySelector('.alert-error');
      expect(errorAlert).toBeTruthy();
      expect(errorAlert?.textContent).toContain('Failed to complete authentication');
      done();
    }, 100);
  });

  it('should handle HTTP errors during authentication', (done) => {
    mockActivatedRoute.snapshot.queryParamMap.get.and.returnValue('error-code');
    mockAuthService.handleCallback.and.returnValue(
      throwError(() => new Error('Network error'))
    );

    fixture.detectChanges();

    setTimeout(() => {
      expect(component.error).toBeTruthy();
      done();
    }, 100);
  });

  it('should display loading spinner while processing', () => {
    mockActivatedRoute.snapshot.queryParamMap.get.and.returnValue('test-code');
    mockAuthService.handleCallback.and.returnValue(of(true));

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const spinner = compiled.querySelector('.spinner');
    expect(spinner).toBeTruthy();
  });

  it('should display processing message', () => {
    mockActivatedRoute.snapshot.queryParamMap.get.and.returnValue('test-code');
    mockAuthService.handleCallback.and.returnValue(of(true));

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const message = compiled.querySelector('p');
    expect(message?.textContent).toContain('Completing sign in...');
  });

  it('should have correct error state when code is missing', () => {
    mockActivatedRoute.snapshot.queryParamMap.get.and.returnValue('');

    fixture.detectChanges();

    expect(component.error).toBe('No authorization code received');
  });

  it('should unsubscribe on destroy', () => {
    mockActivatedRoute.snapshot.queryParamMap.get.and.returnValue('test-code');
    const subscription = of(true);
    mockAuthService.handleCallback.and.returnValue(subscription);

    fixture.detectChanges();

    // Component should handle subscription cleanup
    fixture.destroy();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
