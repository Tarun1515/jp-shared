import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type UiAuthShellTone = 'default' | 'waiting' | 'danger';

/**
 * The chrome every auth screen sits in, in all three apps.
 *
 * ----------------------------------------------------------------------------
 * TWO LAYOUTS, ONE COMPONENT
 * ----------------------------------------------------------------------------
 * Below 1024px: a single ruled sheet on chalk ground. The phone gets the whole
 * page, not the leftover half of one — teachers are on phones, and that is the
 * primary experience.
 *
 * From 1024px: the sheet moves left and the board continues down the right.
 *
 * ----------------------------------------------------------------------------
 * THE PANEL IS PROJECTED, NOT BUILT IN
 * ----------------------------------------------------------------------------
 * The three apps have genuinely different things to say beside their login
 * form — the school and teacher apps explain what is on the other side of the
 * door, the admin console deliberately advertises nothing. Baking one panel in
 * and toggling it per app would have meant either three booleans here or an
 * admin console showing marketing.
 *
 * So each app projects its own `[authPanel]`. Nothing is projected on a phone,
 * where the panel is not laid out at all.
 */
@Component({
  selector: 'ui-auth-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-auth-shell.component.html',
  styleUrl: './ui-auth-shell.component.scss',
})
export class UiAuthShellComponent {
  readonly title = input.required<string>();

  readonly subtitle = input<string>();

  /**
   * The numeral written in the margin, e.g. "Step 2 of 3".
   * Decorative — aria-hidden, because the heading already says where you are.
   */
  readonly step = input<string>();

  /** Colours the sheet's margin rule. */
  readonly tone = input<UiAuthShellTone>('default');

  /** Widens the sheet for the two-column signup forms. */
  readonly wide = input(false);

  /** Line beside the wordmark on the board. Each app sets its own. */
  readonly boardNote = input('Verified schools. Real teachers.');
}
