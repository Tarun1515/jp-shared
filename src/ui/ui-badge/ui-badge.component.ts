import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type UiBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
export type UiBadgeSize = 'sm' | 'md' | 'lg';

/**
 * Status pill. One vocabulary of tones for every status in the system — job,
 * application, verification, report, offer.
 *
 * The projected TEXT carries the meaning; the tone only reinforces it. A badge
 * with no text, or one distinguished from its neighbour by colour alone, is
 * unusable for someone who cannot separate red from green.
 *
 * @example
 * <ui-badge tone="warning">Pending verification</ui-badge>
 */
@Component({
  selector: 'ui-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-badge.component.html',
  styleUrl: './ui-badge.component.scss',
})
export class UiBadgeComponent {
  readonly tone = input<UiBadgeTone>('neutral');
  readonly size = input<UiBadgeSize>('md');

  /** Shows a small leading disc. Decorative, and hidden from assistive tech. */
  readonly dot = input(false);

  protected readonly classes = computed(() => {
    const classes = ['badge', `badge--${this.tone()}`];

    if (this.size() !== 'md') {
      classes.push(`badge--${this.size()}`);
    }

    return classes.join(' ');
  });
}
