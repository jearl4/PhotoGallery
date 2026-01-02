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
  template: `
    <div class="upload-page">
      <div class="upload-container">
        <div class="upload-header">
          <button class="btn-back" (click)="goBack()">
            ← Back to Gallery
          </button>
          <h1>Upload Photos</h1>
        </div>

        <!-- Drag and Drop Zone -->
        <div
          class="dropzone"
          [class.dragging]="isDragging()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()">
          <div class="dropzone-content">
            <div class="dropzone-icon">📸</div>
            <h3>Drag and drop photos here</h3>
            <p>or click to browse</p>
            <span class="dropzone-hint">Supports: JPG, PNG, WebP</span>
          </div>

          <input
            #fileInput
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp"
            (change)="onFileSelect($event)"
            style="display: none">
        </div>

        <!-- Upload Queue -->
        @if (files().length > 0) {
          <div class="upload-queue">
            <div class="queue-header">
              <h3>Upload Queue ({{ files().length }} files)</h3>
              <div class="queue-actions">
                @if (!isUploading()) {
                  <button
                    class="btn btn-secondary"
                    (click)="clearAll()"
                    [disabled]="isUploading()">
                    Clear All
                  </button>
                  <button
                    class="btn btn-primary"
                    (click)="startUpload()"
                    [disabled]="isUploading()">
                    Upload All
                  </button>
                } @else {
                  <button
                    class="btn btn-secondary"
                    (click)="cancelUpload()">
                    Cancel
                  </button>
                }
              </div>
            </div>

            <div class="upload-list">
              @for (uploadFile of files(); track uploadFile.file.name) {
                <div class="upload-item" [class.error]="uploadFile.status === 'error'">
                  <div class="upload-item-left">
                    <div class="file-icon">📷</div>
                    <div class="file-info">
                      <div class="file-name">{{ uploadFile.file.name }}</div>
                      <div class="file-size">{{ formatFileSize(uploadFile.file.size) }}</div>
                    </div>
                  </div>

                  <div class="upload-item-right">
                    @if (uploadFile.status === 'pending') {
                      <span class="status-text">Pending</span>
                      <button
                        class="btn-remove"
                        (click)="removeFile(uploadFile)"
                        [disabled]="isUploading()">
                        ✕
                      </button>
                    } @else if (uploadFile.status === 'uploading') {
                      <div class="progress-bar">
                        <div
                          class="progress-fill"
                          [style.width.%]="uploadFile.progress">
                        </div>
                      </div>
                      <span class="status-text">{{ uploadFile.progress }}%</span>
                    } @else if (uploadFile.status === 'success') {
                      <span class="status-icon success">✓</span>
                      <span class="status-text">Complete</span>
                    } @else if (uploadFile.status === 'error') {
                      <span class="status-icon error">✕</span>
                      <span class="status-text error">{{ uploadFile.errorMessage || 'Failed' }}</span>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Overall Progress -->
            @if (isUploading()) {
              <div class="overall-progress">
                <div class="progress-info">
                  <span>Uploading {{ completedCount() }} of {{ files().length }}</span>
                  <span>{{ overallProgress() }}%</span>
                </div>
                <div class="progress-bar large">
                  <div
                    class="progress-fill"
                    [style.width.%]="overallProgress()">
                  </div>
                </div>
              </div>
            }

            <!-- Success Message -->
            @if (allComplete()) {
              <div class="success-message">
                <div class="success-icon">✓</div>
                <h3>Upload Complete!</h3>
                <p>{{ successCount() }} photos uploaded successfully</p>
                <button class="btn btn-primary" (click)="goBack()">
                  View Gallery
                </button>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .upload-page {
      min-height: 100vh;
      background: #f5f7fa;
      padding: 40px 20px;
    }

    .upload-container {
      max-width: 800px;
      margin: 0 auto;
    }

    .upload-header {
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
      display: inline-block;
    }

    .btn-back:hover {
      text-decoration: underline;
    }

    h1 {
      margin: 0;
      font-size: 28px;
      color: #1a1a1a;
    }

    .dropzone {
      background: white;
      border: 3px dashed #e5e7eb;
      border-radius: 16px;
      padding: 60px 40px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
    }

    .dropzone:hover,
    .dropzone.dragging {
      border-color: #667eea;
      background: #f8f9ff;
    }

    .dropzone-content {
      pointer-events: none;
    }

    .dropzone-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }

    .dropzone h3 {
      margin: 0 0 8px 0;
      font-size: 20px;
      color: #1a1a1a;
    }

    .dropzone p {
      margin: 0 0 12px 0;
      color: #666;
    }

    .dropzone-hint {
      font-size: 13px;
      color: #999;
    }

    .upload-queue {
      margin-top: 32px;
      background: white;
      border-radius: 12px;
      padding: 24px;
    }

    .queue-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .queue-header h3 {
      margin: 0;
      font-size: 18px;
      color: #1a1a1a;
    }

    .queue-actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5568d3;
    }

    .btn-secondary {
      background: #f5f7fa;
      color: #666;
      border: 1px solid #e5e7eb;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #e5e7eb;
    }

    .upload-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .upload-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: #f5f7fa;
      border-radius: 8px;
      gap: 16px;
    }

    .upload-item.error {
      background: #fee2e2;
    }

    .upload-item-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .file-icon {
      font-size: 32px;
      flex-shrink: 0;
    }

    .file-info {
      min-width: 0;
      flex: 1;
    }

    .file-name {
      font-size: 14px;
      color: #1a1a1a;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-size {
      font-size: 12px;
      color: #666;
      margin-top: 2px;
    }

    .upload-item-right {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .progress-bar {
      width: 120px;
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-bar.large {
      width: 100%;
      height: 8px;
    }

    .progress-fill {
      height: 100%;
      background: #667eea;
      transition: width 0.3s;
    }

    .status-text {
      font-size: 13px;
      color: #666;
      min-width: 60px;
      text-align: right;
    }

    .status-text.error {
      color: #c62828;
    }

    .status-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: bold;
    }

    .status-icon.success {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .status-icon.error {
      background: #ffebee;
      color: #c62828;
    }

    .btn-remove {
      width: 24px;
      height: 24px;
      border: none;
      background: white;
      border-radius: 50%;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .btn-remove:hover:not(:disabled) {
      background: #ffebee;
      color: #c62828;
    }

    .overall-progress {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }

    .success-message {
      text-align: center;
      padding: 40px 20px;
      margin-top: 24px;
      border-top: 1px solid #e5e7eb;
    }

    .success-icon {
      width: 64px;
      height: 64px;
      background: #e8f5e9;
      color: #2e7d32;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      margin: 0 auto 16px;
    }

    .success-message h3 {
      margin: 0 0 8px 0;
      font-size: 20px;
      color: #1a1a1a;
    }

    .success-message p {
      margin: 0 0 24px 0;
      color: #666;
    }

    @media (max-width: 640px) {
      .dropzone {
        padding: 40px 20px;
      }

      .queue-header {
        flex-direction: column;
        align-items: stretch;
      }

      .queue-actions {
        width: 100%;
      }

      .btn {
        flex: 1;
      }
    }
  `]
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
      input.value = ''; // Reset input
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
    const maxSize = 50 * 1024 * 1024; // 50MB

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
      // Step 1: Get upload URL
      const urlResponse = await this.apiService.getUploadUrl(
        this.galleryId,
        uploadFile.file.name,
        uploadFile.file.type
      ).toPromise();

      if (!urlResponse) throw new Error('No upload URL received');

      uploadFile.photoId = urlResponse.photoId;

      // Step 2: Upload to S3
      await this.uploadToS3(uploadFile, urlResponse.uploadUrl);

      uploadFile.status = 'success';
      uploadFile.progress = 100;
    } catch (error: any) {
      // Don't overwrite cancelled status (can be set by cancelUpload())
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
      uploadFile.xhr = xhr; // Store XHR for cancellation

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          uploadFile.progress = Math.round((event.loaded / event.total) * 100);
          this.files.set([...this.files()]);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          uploadFile.xhr = undefined; // Clear XHR reference
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

    // Abort all active XHR requests
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
