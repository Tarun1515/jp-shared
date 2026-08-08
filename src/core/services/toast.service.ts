import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Milliseconds before auto-dismiss. 0 keeps it until dismissed. */
  durationMs: number;
}

/** Transient notifications, rendered by ToastContainer. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSignal = signal<Toast[]>([]);
  private nextId = 1;

  readonly toasts = this.toastsSignal.asReadonly();

  success(message: string, durationMs = 4000): void {
    this.push('success', message, durationMs);
  }

  /**
   * Errors linger longer than successes, and are not auto-dismissed at all
   * when the caller passes 0 — a failure the user never saw is a failure they
   * will report as "nothing happened".
   */
  error(message: string, durationMs = 8000): void {
    this.push('error', message, durationMs);
  }

  warning(message: string, durationMs = 6000): void {
    this.push('warning', message, durationMs);
  }

  info(message: string, durationMs = 4000): void {
    this.push('info', message, durationMs);
  }

  dismiss(id: number): void {
    this.toastsSignal.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  clear(): void {
    this.toastsSignal.set([]);
  }

  private push(kind: ToastKind, message: string, durationMs: number): void {
    const toast: Toast = { id: this.nextId++, kind, message, durationMs };
    this.toastsSignal.update((toasts) => [...toasts, toast]);

    if (durationMs > 0) {
      setTimeout(() => this.dismiss(toast.id), durationMs);
    }
  }
}
