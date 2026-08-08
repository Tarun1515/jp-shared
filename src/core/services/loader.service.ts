import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks how many HTTP requests are in flight.
 *
 * A counter rather than a boolean: with a flag, two concurrent requests would
 * leave the spinner off as soon as the *first* one finished, while the screen
 * was still waiting on the second.
 */
@Injectable({ providedIn: 'root' })
export class LoaderService {
  private readonly pending = signal(0);

  readonly isLoading = computed(() => this.pending() > 0);

  show(): void {
    this.pending.update((count) => count + 1);
  }

  hide(): void {
    // Floored at zero so an unbalanced hide() can never drive the count
    // negative and wedge the spinner on for the rest of the session.
    this.pending.update((count) => Math.max(0, count - 1));
  }

  reset(): void {
    this.pending.set(0);
  }
}
