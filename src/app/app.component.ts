import { ChangeDetectionStrategy, Component } from '@angular/core';

import { UiBadgeComponent } from '../ui/ui-badge/ui-badge.component';
import { UiButtonComponent } from '../ui/ui-button/ui-button.component';

/**
 * jp-shared is a REMOTE, not a product. This page exists so that opening
 * :4999 in a browser answers one question — "is the remote actually up?" —
 * without having to read a terminal.
 *
 * It renders two real components from the design system, so a blank page here
 * means the remote's own build is broken rather than the federation wiring.
 * Nothing in the four apps imports it, and it is not exposed.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiBadgeComponent, UiButtonComponent],
  template: `
    <main class="probe">
      <p class="probe__eyebrow">jp-shared</p>
      <h1 class="probe__title">Federation remote is running</h1>
      <p class="probe__note">
        Serving <code>remoteEntry.json</code> on this origin. The four apps load
        <code>jp-shared/ui</code>, <code>/core</code>, <code>/models</code> and
        <code>/pages</code> from here at runtime.
      </p>

      <div class="probe__row">
        <ui-badge tone="success" [dot]="true">live</ui-badge>
        <ui-button variant="secondary" size="sm">a real ui-button</ui-button>
      </div>
    </main>
  `,
  styles: `
    .probe {
      max-width: 34rem;
      margin: 4rem auto;
      padding-inline: 1.5rem;
      font-family: var(--jp-font-family);
      color: var(--jp-text);
    }
    .probe__eyebrow {
      font-family: var(--jp-font-family-mono);
      font-size: var(--jp-font-size-sm);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--jp-text-muted);
      margin: 0;
    }
    .probe__title {
      font-family: var(--jp-font-family-display);
      font-size: var(--jp-font-size-2xl);
      margin: 0.25rem 0 0.75rem;
    }
    .probe__note {
      color: var(--jp-text-muted);
      margin: 0 0 1.5rem;
    }
    .probe__row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
  `,
})
export class AppComponent {}
