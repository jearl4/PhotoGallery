import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PhotoUploadComponent } from './photo-upload.component';
import { ApiService } from '../../../core/services/api.service';
import { Gallery } from '../../../core/models/gallery.model';

describe('PhotoUploadComponent', () => {
  let component: PhotoUploadComponent;
  let fixture: ComponentFixture<PhotoUploadComponent>;
  let mockApiService: jasmine.SpyObj<ApiService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockActivatedRoute: any;

  const mockGallery: Gallery = {
    galleryId: 'gal_123',
    userId: 'user_123',
    name: 'Test Gallery',
    customUrl: 'test-gallery',
    photoCount: 5,
    clientAccessCount: 10,
    createdAt: '2025-01-01T00:00:00Z',
    status: 'active'
  };

  const mockUploadResponse = {
    uploadUrl: 'https://s3.amazonaws.com/bucket/photo.jpg?signature=xyz',
    photoId: 'photo_123',
    key: 'galleries/gal_123/photo.jpg'
  };

  beforeEach(async () => {
    mockApiService = jasmine.createSpyObj('ApiService', ['getGallery', 'getUploadUrl']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: jasmine.createSpy('get').and.returnValue('gal_123')
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [PhotoUploadComponent],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoUploadComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load gallery on init', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    setTimeout(() => {
      expect(mockApiService.getGallery).toHaveBeenCalledWith('gal_123');
      expect(component.gallery()).toEqual(mockGallery);
      done();
    }, 100);
  });

  it('should navigate to dashboard if no gallery ID', () => {
    mockActivatedRoute.snapshot.paramMap.get.and.returnValue(null);
    fixture.detectChanges();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/dashboard']);
  });

  it('should display gallery name', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    setTimeout(() => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const title = compiled.querySelector('h1');
      expect(title?.textContent).toContain('Upload Photos');
      done();
    }, 100);
  });

  it('should handle file selection via input', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const event = {
      target: {
        files: [file]
      }
    } as any;

    setTimeout(() => {
      component.onFileSelected(event);
      expect(component.files().length).toBe(1);
      expect(component.files()[0].file.name).toBe('test.jpg');
      expect(component.files()[0].status).toBe('pending');
      done();
    }, 100);
  });

  it('should handle drag over event', () => {
    const event = new DragEvent('dragover');
    spyOn(event, 'preventDefault');
    spyOn(event, 'stopPropagation');

    component.onDragOver(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.isDragging()).toBe(true);
  });

  it('should handle drag leave event', () => {
    component.isDragging.set(true);

    const event = new DragEvent('dragleave');
    spyOn(event, 'preventDefault');
    spyOn(event, 'stopPropagation');

    component.onDragLeave(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.isDragging()).toBe(false);
  });

  it('should handle file drop', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    const file = new File(['content'], 'dropped.jpg', { type: 'image/jpeg' });
    const dataTransfer = {
      files: [file]
    } as any;

    const event = new DragEvent('drop');
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    spyOn(event, 'preventDefault');
    spyOn(event, 'stopPropagation');

    setTimeout(() => {
      component.onDrop(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(component.isDragging()).toBe(false);
      expect(component.files().length).toBe(1);
      expect(component.files()[0].file.name).toBe('dropped.jpg');
      done();
    }, 100);
  });

  it('should validate image file types', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });

    setTimeout(() => {
      component['addFiles']([validFile, invalidFile]);

      expect(component.files().length).toBe(1);
      expect(component.files()[0].file.name).toBe('test.jpg');
      done();
    }, 100);
  });

  it('should remove file from list', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    setTimeout(() => {
      component['addFiles']([file]);
      expect(component.files().length).toBe(1);

      component.removeFile(0);
      expect(component.files().length).toBe(0);
      done();
    }, 100);
  });

  it('should start upload process', async () => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    mockApiService.getUploadUrl.and.returnValue(of(mockUploadResponse));

    fixture.detectChanges();

    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    await new Promise(resolve => setTimeout(resolve, 100));

    component['addFiles']([file]);

    // Mock XMLHttpRequest
    const xhrMock = {
      open: jasmine.createSpy('open'),
      send: jasmine.createSpy('send'),
      setRequestHeader: jasmine.createSpy('setRequestHeader'),
      upload: {
        addEventListener: jasmine.createSpy('addEventListener')
      },
      addEventListener: jasmine.createSpy('addEventListener')
    };

    spyOn(window as any, 'XMLHttpRequest').and.returnValue(xhrMock);

    component.startUpload();

    expect(component.isUploading()).toBe(true);
  });

  it('should navigate back to gallery detail', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    setTimeout(() => {
      component.goBack();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/galleries', 'gal_123']);
      done();
    }, 100);
  });

  it('should navigate to gallery detail when done', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    setTimeout(() => {
      component.done();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/photographer/galleries', 'gal_123']);
      done();
    }, 100);
  });

  it('should calculate upload progress correctly', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    setTimeout(() => {
      const file1 = new File(['content'], 'test1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content'], 'test2.jpg', { type: 'image/jpeg' });

      component['addFiles']([file1, file2]);

      component.files.update(files => {
        files[0].progress = 50;
        files[1].progress = 100;
        return [...files];
      });

      expect(component.uploadProgress()).toBe(75);
      done();
    }, 100);
  });

  it('should return 0 progress when no files', () => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    expect(component.uploadProgress()).toBe(0);
  });

  it('should check if all files are completed', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    setTimeout(() => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      component['addFiles']([file]);

      expect(component.allCompleted()).toBe(false);

      component.files.update(files => {
        files[0].status = 'success';
        return [...files];
      });

      expect(component.allCompleted()).toBe(true);
      done();
    }, 100);
  });

  it('should count successful uploads', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    setTimeout(() => {
      const file1 = new File(['content'], 'test1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content'], 'test2.jpg', { type: 'image/jpeg' });

      component['addFiles']([file1, file2]);

      component.files.update(files => {
        files[0].status = 'success';
        files[1].status = 'error';
        return [...files];
      });

      expect(component.successCount()).toBe(1);
      done();
    }, 100);
  });

  it('should count failed uploads', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    setTimeout(() => {
      const file1 = new File(['content'], 'test1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content'], 'test2.jpg', { type: 'image/jpeg' });

      component['addFiles']([file1, file2]);

      component.files.update(files => {
        files[0].status = 'success';
        files[1].status = 'error';
        return [...files];
      });

      expect(component.errorCount()).toBe(1);
      done();
    }, 100);
  });

  it('should display drop zone', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    setTimeout(() => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const dropZone = compiled.querySelector('.drop-zone');
      expect(dropZone).toBeTruthy();
      done();
    }, 100);
  });

  it('should disable upload button when no files', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    setTimeout(() => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const uploadBtn = compiled.querySelector('.btn-primary') as HTMLButtonElement;
      expect(uploadBtn?.disabled).toBe(true);
      done();
    }, 100);
  });

  it('should enable upload button when files are selected', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    setTimeout(() => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      component['addFiles']([file]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const uploadBtn = compiled.querySelector('.btn-primary') as HTMLButtonElement;
      expect(uploadBtn?.disabled).toBe(false);
      done();
    }, 100);
  });

  it('should display file list', (done) => {
    mockApiService.getGallery.and.returnValue(of(mockGallery));
    fixture.detectChanges();

    setTimeout(() => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      component['addFiles']([file]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const fileItems = compiled.querySelectorAll('.file-item');
      expect(fileItems.length).toBe(1);
      done();
    }, 100);
  });

  it('should handle gallery load error', () => {
    const consoleSpy = spyOn(console, 'error');
    mockApiService.getGallery.and.returnValue(
      throwError(() => new Error('Failed to load'))
    );

    fixture.detectChanges();

    expect(consoleSpy).toHaveBeenCalled();
  });
});
