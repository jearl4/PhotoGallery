import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../core/services/api.service';

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'cancelled';
  errorMessage?: string;
  photoId?: string;
  xhr?: XMLHttpRequest;
}

@Component({
  selector: 'app-photo-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-upload.component.html',
  styleUrl: './photo-upload.component.scss'
})
export class PhotoUploadComponent implements OnInit {
  private apiService = inject(ApiService);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  galleryId!: string;
  files = signal<UploadFile[]>([]);
  isDragging = signal(false);
  isUploading = signal(false);

  ngOnInit(): void {
    this.galleryId = this.route.snapshot.paramMap.get('id')!;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles) {
      this.addFiles(Array.from(droppedFiles));
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
      input.value = '';
    }
  }

  private addFiles(newFiles: File[]): void {
    const validFiles = newFiles.filter(file => this.isValidFile(file));
    const uploadFiles: UploadFile[] = validFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending'
    }));

    this.files.set([...this.files(), ...uploadFiles]);
  }

  private isValidFile(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 50 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      alert(`${file.name} is not a supported image type`);
      return false;
    }

    if (file.size > maxSize) {
      alert(`${file.name} is too large (max 50MB)`);
      return false;
    }

    return true;
  }

  removeFile(uploadFile: UploadFile): void {
    this.files.set(this.files().filter(f => f !== uploadFile));
  }

  clearAll(): void {
    this.files.set([]);
  }

  async startUpload(): Promise<void> {
    this.isUploading.set(true);

    for (const uploadFile of this.files()) {
      if (uploadFile.status !== 'pending') continue;

      try {
        await this.uploadFile(uploadFile);
      } catch (error) {
        console.error('Upload error:', error);
      }
    }

    this.isUploading.set(false);
  }

  private async uploadFile(uploadFile: UploadFile): Promise<void> {
    uploadFile.status = 'uploading';
    this.files.set([...this.files()]);

    try {
      const urlResponse = await this.apiService.getUploadUrl(
        this.galleryId,
        uploadFile.file.name,
        uploadFile.file.type
      ).toPromise();

      if (!urlResponse) throw new Error('No upload URL received');

      uploadFile.photoId = urlResponse.photoId;

      await this.uploadToS3(uploadFile, urlResponse.uploadUrl);

      uploadFile.status = 'success';
      uploadFile.progress = 100;
    } catch (error: any) {
      if ((uploadFile.status as string) !== 'cancelled') {
        uploadFile.status = 'error';
        uploadFile.errorMessage = error.message || 'Upload failed';
      }
    }

    this.files.set([...this.files()]);
  }

  private uploadToS3(uploadFile: UploadFile, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      uploadFile.xhr = xhr;

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          uploadFile.progress = Math.round((event.loaded / event.total) * 100);
          this.files.set([...this.files()]);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          uploadFile.xhr = undefined;
          resolve();
        } else {
          uploadFile.xhr = undefined;
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        uploadFile.xhr = undefined;
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        uploadFile.xhr = undefined;
        reject(new Error('Upload cancelled'));
      });

      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', uploadFile.file.type);
      xhr.send(uploadFile.file);
    });
  }

  cancelUpload(): void {
    if (!confirm('Cancel all uploads? Files that are uploading will be stopped.')) {
      return;
    }

    this.files().forEach(file => {
      if (file.xhr) {
        file.xhr.abort();
      }
      if (file.status === 'uploading' || file.status === 'pending') {
        file.status = 'cancelled';
        file.errorMessage = 'Upload cancelled by user';
      }
    });

    this.isUploading.set(false);
    this.files.set([...this.files()]);
  }

  completedCount(): number {
    return this.files().filter(f => f.status === 'success' || f.status === 'error' || f.status === 'cancelled').length;
  }

  successCount(): number {
    return this.files().filter(f => f.status === 'success').length;
  }

  overallProgress(): number {
    if (this.files().length === 0) return 0;
    const total = this.files().reduce((sum, f) => sum + f.progress, 0);
    return Math.round(total / this.files().length);
  }

  allComplete(): boolean {
    return this.files().length > 0 &&
           this.files().every(f => f.status === 'success' || f.status === 'error' || f.status === 'cancelled');
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  goBack(): void {
    this.router.navigate(['/photographer/galleries', this.galleryId]);
  }
}
