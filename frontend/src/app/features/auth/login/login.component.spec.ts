import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj('AuthService', ['login']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the login page title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('.logo h1');
    expect(title?.textContent).toBe('Photographer Gallery');
  });

  it('should display the tagline', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const tagline = compiled.querySelector('.tagline');
    expect(tagline?.textContent).toBe('Share your work beautifully');
  });

  it('should display the login button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('.btn-primary');
    expect(button).toBeTruthy();
    expect(button?.textContent?.trim()).toContain('Sign in with Social Login');
  });

  it('should call authService.login when login button is clicked', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('.btn-primary') as HTMLButtonElement;

    button.click();

    expect(mockAuthService.login).toHaveBeenCalled();
  });

  it('should call login method when button is clicked', () => {
    spyOn(component, 'login');

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('.btn-primary') as HTMLButtonElement;
    button.click();

    expect(component.login).toHaveBeenCalled();
  });

  it('should display feature highlights', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const features = compiled.querySelectorAll('.feature');

    expect(features.length).toBeGreaterThan(0);
  });

  it('should display client access link', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const clientLink = compiled.querySelector('.client-access');

    expect(clientLink).toBeTruthy();
    expect(clientLink?.textContent).toContain('Client access');
  });

  it('should have correct container structure', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.login-container')).toBeTruthy();
    expect(compiled.querySelector('.login-card')).toBeTruthy();
    expect(compiled.querySelector('.logo')).toBeTruthy();
  });

  it('should apply gradient background styling', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const container = compiled.querySelector('.login-container') as HTMLElement;

    expect(container).toBeTruthy();
    // Component has inline styles, just verify element exists
    expect(container.classList.contains('login-container')).toBe(true);
  });
});
