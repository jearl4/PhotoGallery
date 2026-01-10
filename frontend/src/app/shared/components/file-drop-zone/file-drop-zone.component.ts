/**
 * FileDropZone Component
 * A reusable component for handling file drag-and-drop operations.
 */

import { Component, Input, Output, EventEmitter, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FileValidationResult {
  valid: boolean;
  file: File;
  error?: string;
}

export interface FileDropZoneConfig {
  acceptedTypes?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  allowMultiple?: boolean;
}

@Component({
  selector: 'app-file-drop-zone',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-drop-zone.component.html',
  styleUrl: './file-drop-zone.component.scss'
})
export class FileDropZoneComponent {
  @Input() config = signal<FileDropZoneConfig>({
    acceptedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 100,
    allowMultiple: true
  });
  @Input() disabled = signal<boolean>(false);
  @Input() label = signal<string>('Drop files here or click to browse');
  @Input() hint = signal<string>('Supports JPEG, PNG, GIF, WebP up to 50MB');

  @Output() filesSelected = new EventEmitter<File[]>();
  @Output() validationError = new EventEmitter<string>();

  isDragging = signal<boolean>(false);

  @HostListener('dragenter', ['$event'])
  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.disabled()) {
      this.isDragging.set(true);
    }
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.disabled()) {
      this.isDragging.set(true);
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (this.disabled()) return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFiles(Array.from(files));
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFiles(Array.from(input.files));
      input.value = ''; // Reset to allow selecting same file again
    }
  }

  private handleFiles(files: File[]): void {
    const cfg = this.config();

    // Check max files
    if (cfg.maxFiles && files.length > cfg.maxFiles) {
      this.validationError.emit(`Maximum ${cfg.maxFiles} files allowed`);
      files = files.slice(0, cfg.maxFiles);
    }

    // Validate each file
    const validFiles: File[] = [];
    for (const file of files) {
      const result = this.validateFile(file);
      if (result.valid) {
        validFiles.push(file);
      } else {
        this.validationError.emit(result.error || 'Invalid file');
      }
    }

    if (validFiles.length > 0) {
      this.filesSelected.emit(validFiles);
    }
  }

  private validateFile(file: File): FileValidationResult {
    const cfg = this.config();

    // Check file type
    if (cfg.acceptedTypes && cfg.acceptedTypes.length > 0) {
      const isAccepted = cfg.acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -1));
        }
        return file.type === type;
      });
      if (!isAccepted) {
        return { valid: false, file, error: `File type ${file.type} not allowed` };
      }
    }

    // Check file size
    if (cfg.maxFileSize && file.size > cfg.maxFileSize) {
      const maxMB = (cfg.maxFileSize / (1024 * 1024)).toFixed(0);
      return { valid: false, file, error: `File exceeds maximum size of ${maxMB}MB` };
    }

    return { valid: true, file };
  }

  getAcceptString(): string {
    const cfg = this.config();
    return cfg.acceptedTypes?.join(',') || 'image/*';
  }

  isMultiple(): boolean {
    return this.config().allowMultiple ?? true;
  }
}
