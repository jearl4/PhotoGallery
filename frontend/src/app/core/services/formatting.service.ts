/**
 * Formatting Service
 * Provides common formatting utilities for dates, file sizes, and other display values.
 */

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FormattingService {

  /**
   * Format a date string to a relative or absolute display format.
   * Returns: 'expired', 'today', 'tomorrow', 'in X days', or formatted date.
   */
  formatRelativeDate(dateString: string | undefined): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();

    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffMs = dateDay.getTime() - nowDay.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays < 7) return `in ${diffDays} days`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /**
   * Format a date string to a short relative format for timestamps.
   * Returns: 'X minutes ago', 'X hours ago', 'yesterday', or formatted date.
   */
  formatTimestamp(dateString: string | undefined): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /**
   * Format bytes to human-readable file size.
   * Returns: 'X B', 'X.X KB', 'X.X MB', or 'X.X GB'.
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  /**
   * Format a date string for HTML date input (YYYY-MM-DD).
   */
  formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  /**
   * Format a date input value (YYYY-MM-DD) to ISO string.
   */
  formatDateToISO(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString();
  }

  /**
   * Format a number with commas as thousand separators.
   */
  formatNumber(value: number): string {
    return value.toLocaleString('en-US');
  }

  /**
   * Format a percentage value.
   */
  formatPercentage(value: number, decimals: number = 0): string {
    return value.toFixed(decimals) + '%';
  }

  /**
   * Format image dimensions (e.g., "1920 x 1080").
   */
  formatDimensions(width: number, height: number): string {
    return `${width} x ${height}`;
  }

  /**
   * Truncate text with ellipsis if it exceeds max length.
   */
  truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Format a duration in milliseconds to human-readable format.
   */
  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

/**
 * Standalone formatting functions for use outside of Angular context.
 * These mirror the service methods for use in tests or standalone components.
 */

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

export function formatRelativeDate(dateString: string | undefined): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();

  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = dateDay.getTime() - nowDay.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 7) return `in ${diffDays} days`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTimestamp(dateString: string | undefined): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
