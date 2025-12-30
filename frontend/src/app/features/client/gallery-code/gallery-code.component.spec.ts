import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GalleryCodeComponent } from './gallery-code.component';

describe('GalleryCodeComponent', () => {
  let component: GalleryCodeComponent;
  let fixture: ComponentFixture<GalleryCodeComponent>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [GalleryCodeComponent, ReactiveFormsModule],
      providers: [
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GalleryCodeComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty gallery code', () => {
    expect(component.codeForm.get('galleryCode')?.value).toBe('');
  });

  it('should require gallery code', () => {
    const codeControl = component.codeForm.get('galleryCode');
    expect(codeControl?.valid).toBeFalsy();

    codeControl?.setValue('my-wedding-2024');
    expect(codeControl?.valid).toBeTruthy();
  });

  it('should validate gallery code format', () => {
    const codeControl = component.codeForm.get('galleryCode');

    // Valid codes
    codeControl?.setValue('my-wedding-2024');
    expect(codeControl?.valid).toBeTruthy();

    codeControl?.setValue('test-gallery');
    expect(codeControl?.valid).toBeTruthy();

    codeControl?.setValue('gallery123');
    expect(codeControl?.valid).toBeTruthy();

    // Invalid codes
    codeControl?.setValue('My-Wedding');
    expect(codeControl?.valid).toBeFalsy();

    codeControl?.setValue('test_gallery');
    expect(codeControl?.valid).toBeFalsy();

    codeControl?.setValue('test gallery');
    expect(codeControl?.valid).toBeFalsy();

    codeControl?.setValue('test@gallery');
    expect(codeControl?.valid).toBeFalsy();
  });

  it('should navigate to gallery on valid submit', () => {
    component.codeForm.patchValue({ galleryCode: 'my-wedding-2024' });
    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/gallery', 'my-wedding-2024']);
  });

  it('should trim and lowercase gallery code before navigation', () => {
    component.codeForm.patchValue({ galleryCode: '  My-Gallery  ' });
    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/gallery', 'my-gallery']);
  });

  it('should not navigate on invalid form', () => {
    component.codeForm.patchValue({ galleryCode: '' });
    component.onSubmit();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should show error when code control is touched and invalid', () => {
    const codeControl = component.codeForm.get('galleryCode');
    codeControl?.markAsTouched();

    expect(component.showError()).toBeTruthy();

    codeControl?.setValue('valid-code');
    expect(component.showError()).toBeFalsy();
  });
});
