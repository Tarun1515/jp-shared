import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Shown when a list has nothing in it.
 *
 * An empty result is a normal outcome, not an error. Say what would appear
 * here and offer the action that would create it — "No jobs yet" plus a "Post
 * a job" button is far more use than a blank panel.
 *
 * @example
 * <ui-empty-state
 *   title="No jobs yet"
 *   message="Post your first job and it will show up here."
 *   actionLabel="Post a job"
 *   (action)="createJob()" />
 */
@Component({
  selector: 'ui-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-empty-state.component.html',
  styleUrl: './ui-empty-state.component.scss',
})
export class UiEmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input<string>();

  /** Omit to render no button. */
  readonly actionLabel = input<string>();

  /**
   * Shows the action, disabled.
   *
   * ----------------------------------------------------------------------------
   * 🔴 "NOT YET" ONLY. NEVER "NOT ALLOWED".
   * ----------------------------------------------------------------------------
   * Everywhere else in this product a disabled control is the wrong answer: the
   * head office has no Remove button and the team's owner row has no controls at
   * all, because a greyed-out button reads as broken and gets clicked anyway.
   *
   * This is the one case that differs. An action that does not EXIST yet is
   * worth showing in the place it will appear — it tells somebody what this
   * screen becomes — and <see cref="note"/> says when. An action that exists and
   * is FORBIDDEN must still be removed and explained, not greyed.
   *
   * ⚠️ If you are reaching for this to express "you may not do that", you want
   * the other pattern.
   */
  readonly actionDisabled = input(false);

  /**
   * One line under the action — when it arrives, or why it is not here.
   *
   * Quieter than the message, because it is about the product's timeline rather
   * than about what the person is looking at.
   */
  readonly note = input<string>();

  /** Decorative glyph. Hidden from assistive technology. */
  readonly icon = input<string>('📋');

  /** Tightens spacing for use inside a card or a table body. */
  readonly compact = input(false);

  readonly action = output<void>();
}
