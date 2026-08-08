import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type UiRollSize = 'xs' | 'md' | 'lg';
/**
 * `struck` is for a pipeline that stopped — rejected or withdrawn.
 *
 * ⚠️ Do NOT use `struck` inside a dense table. A struck-through bar is
 * unreadable at a glance, which defeats the only reason the bar exists there.
 * In a list, mute the whole row instead and let the status column say why.
 * `struck` belongs on a detail screen, where there is room to read it.
 *
 * `on-dark` is the panel version: chalk on the board.
 */
export type UiRollTone = 'default' | 'waiting' | 'done' | 'struck' | 'on-dark';

/** One stage on a roll. */
export interface UiRollStage {
  /** Shown under the cell at size `lg`, and read out at every size. */
  label: string;
  /** Optional date or note, shown at size `lg` only. */
  meta?: string;
}

/**
 * The roll — the application pipeline, drawn as an attendance row.
 *
 * Applied → Viewed → Shortlisted → Interview → Selected → Offer → Hired.
 *
 * A row of ruled cells filled up to the current stage. In a table it is a
 * SHAPE, so a column of fifty reads as a histogram — you see the wall everyone
 * is stuck at without reading a word. A column of status pills cannot do that,
 * because every pill is the same size whatever it says.
 *
 * Conventions are the register's: filled = happened, ringed = here now, empty =
 * ahead, struck through = struck off.
 *
 * ACCESSIBILITY. The cells are decorative. The meaning is carried by the
 * `aria-label` on the host — "Shortlisted, stage 3 of 7" — and, at every size
 * except `xs`, by visible text as well. Never rely on the fill alone.
 *
 * @example
 * <ui-roll [stages]="APPLICATION_STAGES" [current]="3" size="xs" />
 */
@Component({
  selector: 'ui-roll',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-roll.component.html',
  styleUrl: './ui-roll.component.scss',
  host: {
    // The host is inline-flex so an xs roll sits in a table cell beside text.
    // At lg the track is meant to span its container, and an inline-flex host
    // shrink-wraps it instead — the cells ended up a third of the card's width
    // with the labels stretched underneath them.
    '[class.roll-host--block]': "size() === 'lg'",
  },
})
export class UiRollComponent {
  readonly stages = input.required<readonly UiRollStage[]>();

  /**
   * 1-based index of the stage reached. 0 means nothing has happened yet.
   * Clamped, so an out-of-range value from the server cannot break the render.
   */
  readonly current = input.required<number>();

  readonly size = input<UiRollSize>('md');

  readonly tone = input<UiRollTone>('default');

  /** Shows the `4/7` numeral. Off at `lg`, where the legend says it better. */
  readonly showCount = input(true);

  /** Shows the current stage name beside the cells. */
  readonly showStage = input(false);

  protected readonly total = computed(() => this.stages().length);

  protected readonly reached = computed(() =>
    Math.max(0, Math.min(this.current(), this.total())),
  );

  protected readonly currentStage = computed(() => {
    const index = this.reached() - 1;
    return index >= 0 ? this.stages()[index] : undefined;
  });

  protected readonly cells = computed(() =>
    this.stages().map((stage, index) => ({
      label: stage.label,
      meta: stage.meta,
      // `struck` collapses "now" into "done": a struck-off application is not
      // sitting at a stage, it stopped at one.
      state:
        index < this.reached() - 1 || (this.tone() === 'struck' && index < this.reached())
          ? 'done'
          : index === this.reached() - 1
            ? 'now'
            : 'todo',
    })),
  );

  protected readonly classes = computed(() => {
    const classes = ['roll', `roll--${this.size()}`];

    if (this.tone() !== 'default') {
      classes.push(`roll--${this.tone()}`);
    }

    return classes.join(' ');
  });

  /**
   * What assistive technology gets instead of the cells.
   *
   * Stated as position AND name, because "stage 3 of 7" alone tells you how far
   * along without telling you where, and "Shortlisted" alone tells you where
   * without telling you how far.
   */
  protected readonly label = computed(() => {
    const stage = this.currentStage();
    const suffix = this.tone() === 'struck' ? ', not proceeding' : '';

    return stage
      ? `${stage.label}, stage ${this.reached()} of ${this.total()}${suffix}`
      : `Not started, 0 of ${this.total()} stages`;
  });
}

/**
 * The application pipeline. One definition, used by the school's applicant
 * list, the teacher's application list, and both detail pages — so the stage
 * names can never drift apart between them.
 */
export const APPLICATION_STAGES: readonly UiRollStage[] = [
  { label: 'Applied' },
  { label: 'Viewed' },
  { label: 'Shortlisted' },
  { label: 'Interview' },
  { label: 'Selected' },
  { label: 'Offer' },
  { label: 'Hired' },
];

/**
 * School verification, on the same component. Three stages rather than seven,
 * which is the point of the roll being a component and not a picture.
 */
export const VERIFICATION_STAGES: readonly UiRollStage[] = [
  { label: 'Submitted' },
  { label: 'In review' },
  { label: 'Approved' },
];
