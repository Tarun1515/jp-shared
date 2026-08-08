import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Styles the confirm button as destructive. Use for delete and suspend. */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * Promise-based confirmation dialog.
 *
 * @example
 * if (await this.confirm.ask({ title: 'Close job', message: '…', danger: true })) {
 *   this.closeJob();
 * }
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly pendingSignal = signal<PendingConfirm | null>(null);

  /** The dialog currently being shown, if any. Read by ConfirmDialog. */
  readonly pending = this.pendingSignal.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    // A second call while one is open resolves the first as cancelled, so its
    // caller is never left awaiting a promise that can no longer settle.
    this.pendingSignal()?.resolve(false);

    return new Promise<boolean>((resolve) => {
      this.pendingSignal.set({ ...options, resolve });
    });
  }

  respond(confirmed: boolean): void {
    const pending = this.pendingSignal();
    if (!pending) {
      return;
    }

    this.pendingSignal.set(null);
    pending.resolve(confirmed);
  }
}
