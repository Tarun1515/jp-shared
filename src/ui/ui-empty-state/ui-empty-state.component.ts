import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

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
 *
 * @example
 * <ui-empty-state
 *   title="No jobs yet"
 *   actionLabel="Post a job"
 *   actionLink="/jobs/new" />
 */
@Component({
  selector: 'ui-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
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

  /**
   * Where the action goes, when it is navigation rather than a handler.
   *
   * ----------------------------------------------------------------------------
   * 🔴 ADDED IN 5B BECAUSE THREE SHIPPED BUTTONS DID NOTHING
   * ----------------------------------------------------------------------------
   * `actionLink` was being written on this component from Phase 4B onward — the
   * jobs list's empty state, and both of the school dashboard's — as a PLAIN
   * ATTRIBUTE. It was not an input, so Angular set it on the host element and
   * dropped it: the button rendered, the click emitted `action`, nobody was
   * listening, and "Post a job" silently did nothing.
   *
   * ⚠️ It could not have been caught by a type error either, because a static
   * attribute that matches no input is legal HTML. `[actionLink]="…"` would have
   * failed the build on day one; `actionLink="…"` compiled happily. That is the
   * whole bug, and it is why this is an input now rather than those three call
   * sites being rewritten.
   *
   * When set, the action renders as an anchor so middle-click and "open in new
   * tab" work — a router `navigate()` behind a button takes both away.
   *
   * ⚠️ Ignored while {@link actionDisabled} is true: a "not yet" action must not
   * be followable, and a disabled anchor is not a thing the browser has.
   */
  readonly actionLink = input<string>();

  /** True when the action should render as a link rather than a button. */
  protected readonly isLink = computed(() => !!this.actionLink() && !this.actionDisabled());

  readonly action = output<void>();
}
