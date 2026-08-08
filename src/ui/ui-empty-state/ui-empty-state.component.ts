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

  /** Decorative glyph. Hidden from assistive technology. */
  readonly icon = input<string>('📋');

  /** Tightens spacing for use inside a card or a table body. */
  readonly compact = input(false);

  readonly action = output<void>();
}
