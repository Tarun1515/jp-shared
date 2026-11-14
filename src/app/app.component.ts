import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { UiBadgeComponent } from '../ui/ui-badge/ui-badge.component';
import { UiButtonComponent } from '../ui/ui-button/ui-button.component';
import { distanceKm } from '../ui/ui-map-picker/map-distance';
import { UiMapPickerComponent, UiMapPoint } from '../ui/ui-map-picker/ui-map-picker.component';

/** Rohtak's town centre — the SR-1 geography seed starts in Haryana. */
const DEMO_ANCHOR: UiMapPoint = { latitude: 28.8955, longitude: 76.6066 };

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
  imports: [UiBadgeComponent, UiButtonComponent, UiMapPickerComponent],
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

      <!--
        ⚠️ THE MAP PICKER IS HERE SO IT CAN BE LOOKED AT WITHOUT AN APP.

        Three apps are being written against this component, so there has to be
        somewhere it can be opened at 1440 and at 375 before any of them is
        ready. This stands in for a host: the latitude and longitude are held
        in signals that (picked) writes, which is exactly the round trip the
        component's emit-loop guard exists for — if that guard were wrong, the
        marker would fight these two signals here first.

        🔴 The pin below was NOT placed by hand. The anchor is set and the
        coordinates start null, so the component seeds the pin and emits it
        once. Everything under the map is what the host was told.

        ⚠️ NO BACKTICKS ANYWHERE IN THIS TEMPLATE. It is a template literal, so
        a backtick in a comment ends the string and the error lands 80 lines
        further down with no hint of why.

        Safe to delete: nothing is exposed from this file and no app imports it.
      -->
      <section class="probe__demo">
        <ui-map-picker
          [latitude]="pin()?.latitude ?? null"
          [longitude]="pin()?.longitude ?? null"
          [anchorLatitude]="anchor.latitude"
          [anchorLongitude]="anchor.longitude"
          (picked)="onPicked($event)"
        />

        <p class="probe__note">
          @if (pin(); as current) {
            Host holds
            <code>{{ current.latitude.toFixed(6) }}, {{ current.longitude.toFixed(6) }}</code>
            — {{ emits() }} emit(s), {{ away() }} km from the address (haversine;
            the server's STDistance is the one that decides anything).
          } @else {
            Nothing emitted yet.
          }
        </p>

        <ui-map-picker
          label="Read view (an admin, before they correct it)"
          [readonly]="true"
          [heightPx]="200"
          [latitude]="pin()?.latitude ?? null"
          [longitude]="pin()?.longitude ?? null"
          [anchorLatitude]="anchor.latitude"
          [anchorLongitude]="anchor.longitude"
        />
      </section>
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
    .probe__demo {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--jp-border);
    }
  `,
})
export class AppComponent {
  protected readonly anchor = DEMO_ANCHOR;

  /** Stands in for the host's form state. */
  protected readonly pin = signal<UiMapPoint | null>(null);

  /** Counted so a loop would be visible rather than invisible. */
  protected readonly emits = signal(0);

  protected readonly away = computed(() => {
    const current = this.pin();

    return current === null
      ? '0.0'
      : distanceKm(
        current.latitude,
        current.longitude,
        this.anchor.latitude,
        this.anchor.longitude,
      ).toFixed(1);
  });

  protected onPicked(point: UiMapPoint): void {
    /*
      ⚠️ ROUNDED ON PURPOSE. A real host stores six decimals, so what comes
      back into `[latitude]` is never bit-identical to what was emitted. This
      is the case that would make a naive `!==` comparison inside the component
      oscillate, so the probe reproduces it rather than being kind.
    */
    this.pin.set({
      latitude: Number(point.latitude.toFixed(6)),
      longitude: Number(point.longitude.toFixed(6)),
    });

    this.emits.update((count) => count + 1);
  }
}
