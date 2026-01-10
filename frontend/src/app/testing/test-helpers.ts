/**
 * Test Helper Utilities
 * Common utilities for Angular component and service testing.
 */

import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';
import { of, throwError, Observable, delay } from 'rxjs';

// ============= DOM Query Helpers =============

/**
 * Query a single element by CSS selector
 */
export function queryByCss<T>(fixture: ComponentFixture<T>, selector: string): DebugElement | null {
  return fixture.debugElement.query(By.css(selector));
}

/**
 * Query all elements by CSS selector
 */
export function queryAllByCss<T>(fixture: ComponentFixture<T>, selector: string): DebugElement[] {
  return fixture.debugElement.queryAll(By.css(selector));
}

/**
 * Get native element by CSS selector
 */
export function getNativeElement<T>(fixture: ComponentFixture<T>, selector: string): HTMLElement | null {
  const debugEl = queryByCss(fixture, selector);
  return debugEl?.nativeElement ?? null;
}

/**
 * Get all native elements by CSS selector
 */
export function getAllNativeElements<T>(fixture: ComponentFixture<T>, selector: string): HTMLElement[] {
  return queryAllByCss(fixture, selector).map(de => de.nativeElement);
}

/**
 * Get text content of an element
 */
export function getTextContent<T>(fixture: ComponentFixture<T>, selector: string): string {
  const element = getNativeElement(fixture, selector);
  return element?.textContent?.trim() ?? '';
}

/**
 * Check if element exists in the DOM
 */
export function elementExists<T>(fixture: ComponentFixture<T>, selector: string): boolean {
  return queryByCss(fixture, selector) !== null;
}

/**
 * Count elements matching selector
 */
export function countElements<T>(fixture: ComponentFixture<T>, selector: string): number {
  return queryAllByCss(fixture, selector).length;
}

// ============= Event Helpers =============

/**
 * Simulate a click event on an element
 */
export function click<T>(fixture: ComponentFixture<T>, selector: string): void {
  const element = getNativeElement(fixture, selector);
  element?.click();
  fixture.detectChanges();
}

/**
 * Simulate input event with value
 */
export function setInputValue<T>(fixture: ComponentFixture<T>, selector: string, value: string): void {
  const input = getNativeElement(fixture, selector) as HTMLInputElement;
  if (input) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }
}

/**
 * Simulate form submission
 */
export function submitForm<T>(fixture: ComponentFixture<T>, formSelector: string = 'form'): void {
  const form = getNativeElement(fixture, formSelector);
  form?.dispatchEvent(new Event('submit'));
  fixture.detectChanges();
}

/**
 * Simulate drag event
 */
export function simulateDragEvent(type: 'dragenter' | 'dragover' | 'dragleave' | 'drop', files: File[] = []): DragEvent {
  const dataTransfer = new DataTransfer();
  files.forEach(f => dataTransfer.items.add(f));

  return new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    dataTransfer
  });
}

// ============= Async Helpers =============

/**
 * Wait for fixture to be stable
 */
export async function waitForStable<T>(fixture: ComponentFixture<T>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

/**
 * Wait for a specific amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Flush pending timers (use with fakeAsync)
 */
export function flushTimers(): void {
  // This should be used within fakeAsync zone
  // tick() and flush() from @angular/core/testing should be used
}

// ============= Mock Service Helpers =============

/**
 * Create a mock observable that emits a value
 */
export function mockObservable<T>(value: T): Observable<T> {
  return of(value);
}

/**
 * Create a mock observable that emits after delay
 */
export function mockDelayedObservable<T>(value: T, delayMs: number): Observable<T> {
  return of(value).pipe(delay(delayMs));
}

/**
 * Create a mock observable that throws an error
 */
export function mockErrorObservable(error: any): Observable<never> {
  return throwError(() => error);
}

/**
 * Create a mock HTTP error response
 */
export function createHttpError(status: number, message: string = 'Error'): any {
  return {
    status,
    statusText: message,
    error: { message }
  };
}

// ============= Spy Helpers =============

/**
 * Create a jasmine spy object with common patterns
 */
export function createSpyObj<T>(name: string, methods: (keyof T)[]): jasmine.SpyObj<T> {
  return jasmine.createSpyObj(name, methods as string[]);
}

/**
 * Setup spy to return observable
 */
export function spyReturnObservable<T, K extends keyof T>(
  spy: jasmine.SpyObj<T>,
  method: K,
  value: ReturnType<T[K] extends (...args: any[]) => any ? T[K] : never> extends Observable<infer U> ? U : never
): void {
  (spy[method] as jasmine.Spy).and.returnValue(of(value));
}

/**
 * Setup spy to throw error
 */
export function spyThrowError<T, K extends keyof T>(
  spy: jasmine.SpyObj<T>,
  method: K,
  error: any
): void {
  (spy[method] as jasmine.Spy).and.returnValue(throwError(() => error));
}

// ============= Form Helpers =============

/**
 * Get form control value
 */
export function getFormControlValue<T>(fixture: ComponentFixture<T>, controlSelector: string): any {
  const input = getNativeElement(fixture, controlSelector) as HTMLInputElement;
  return input?.value;
}

/**
 * Check if form control has error class
 */
export function hasErrorClass<T>(fixture: ComponentFixture<T>, selector: string): boolean {
  const element = getNativeElement(fixture, selector);
  return element?.classList.contains('error') ?? false;
}

/**
 * Check if button is disabled
 */
export function isButtonDisabled<T>(fixture: ComponentFixture<T>, selector: string): boolean {
  const button = getNativeElement(fixture, selector) as HTMLButtonElement;
  return button?.disabled ?? false;
}

// ============= Storage Helpers =============

/**
 * Mock localStorage for tests
 */
export function mockLocalStorage(): { getItem: jasmine.Spy; setItem: jasmine.Spy; removeItem: jasmine.Spy; clear: jasmine.Spy } {
  const store: Record<string, string> = {};

  const getItem = jasmine.createSpy('getItem').and.callFake((key: string) => store[key] ?? null);
  const setItem = jasmine.createSpy('setItem').and.callFake((key: string, value: string) => { store[key] = value; });
  const removeItem = jasmine.createSpy('removeItem').and.callFake((key: string) => { delete store[key]; });
  const clear = jasmine.createSpy('clear').and.callFake(() => { Object.keys(store).forEach(k => delete store[k]); });

  spyOn(localStorage, 'getItem').and.callFake(getItem);
  spyOn(localStorage, 'setItem').and.callFake(setItem);
  spyOn(localStorage, 'removeItem').and.callFake(removeItem);
  spyOn(localStorage, 'clear').and.callFake(clear);

  return { getItem, setItem, removeItem, clear };
}

/**
 * Mock sessionStorage for tests
 */
export function mockSessionStorage(): { getItem: jasmine.Spy; setItem: jasmine.Spy; removeItem: jasmine.Spy; clear: jasmine.Spy } {
  const store: Record<string, string> = {};

  const getItem = jasmine.createSpy('getItem').and.callFake((key: string) => store[key] ?? null);
  const setItem = jasmine.createSpy('setItem').and.callFake((key: string, value: string) => { store[key] = value; });
  const removeItem = jasmine.createSpy('removeItem').and.callFake((key: string) => { delete store[key]; });
  const clear = jasmine.createSpy('clear').and.callFake(() => { Object.keys(store).forEach(k => delete store[k]); });

  spyOn(sessionStorage, 'getItem').and.callFake(getItem);
  spyOn(sessionStorage, 'setItem').and.callFake(setItem);
  spyOn(sessionStorage, 'removeItem').and.callFake(removeItem);
  spyOn(sessionStorage, 'clear').and.callFake(clear);

  return { getItem, setItem, removeItem, clear };
}

// ============= Assertion Helpers =============

/**
 * Assert element contains text
 */
export function expectTextContains<T>(fixture: ComponentFixture<T>, selector: string, text: string): void {
  const content = getTextContent(fixture, selector);
  expect(content).toContain(text);
}

/**
 * Assert element has class
 */
export function expectHasClass<T>(fixture: ComponentFixture<T>, selector: string, className: string): void {
  const element = getNativeElement(fixture, selector);
  expect(element?.classList.contains(className)).toBe(true);
}

/**
 * Assert element does not have class
 */
export function expectNotHasClass<T>(fixture: ComponentFixture<T>, selector: string, className: string): void {
  const element = getNativeElement(fixture, selector);
  expect(element?.classList.contains(className)).toBe(false);
}

/**
 * Assert element is visible (not hidden by CSS)
 */
export function expectVisible<T>(fixture: ComponentFixture<T>, selector: string): void {
  const element = getNativeElement(fixture, selector);
  expect(element).toBeTruthy();
  if (element) {
    const style = window.getComputedStyle(element);
    expect(style.display).not.toBe('none');
    expect(style.visibility).not.toBe('hidden');
  }
}

/**
 * Assert element count
 */
export function expectElementCount<T>(fixture: ComponentFixture<T>, selector: string, count: number): void {
  expect(countElements(fixture, selector)).toBe(count);
}
