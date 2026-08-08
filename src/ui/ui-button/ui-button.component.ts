import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type UiButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link' | 'default';
export type UiButtonSize = 'sm' | 'md' | 'lg';

/**
 * The standard button.
 *
 * Click handling is left to native bubbling — put `(click)` on the host and it
 * works, because a click on the inner `<button>` bubbles out. A disabled or
 * loading button emits nothing, so no guard is needed at the call site:
 *
 * @example
 * <ui-button variant="primary" [loading]="saving()" (click)="save()">Save</ui-button>
 */
@Component({
  selector: 'ui-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-button.component.html',
  styleUrl: './ui-button.component.scss',
})
export class UiButtonComponent {
  readonly variant = input<UiButtonVariant>('default');
  readonly size = input<UiButtonSize>('md');

  /**
   * Defaults to `button`. Set `submit` deliberately — a bare `<button>` inside
   * a form submits it, which is a common source of accidental double posts.
   */
  readonly type = input<'button' | 'submit' | 'reset'>('button');

  readonly disabled = input(false);

  /** Shows a spinner and blocks interaction, while keeping the label's width. */
  readonly loading = input(false);

  readonly block = input(false);

  /** Square icon-only button. Requires `ariaLabel`. */
  readonly iconOnly = input(false);

  /** Required whenever the button's only content is an icon. */
  readonly ariaLabel = input<string>();

  protected readonly isInactive = computed(() => this.disabled() || this.loading());

  protected readonly classes = computed(() => {
    const classes = ['btn'];

    if (this.variant() !== 'default') {
      classes.push(`btn--${this.variant()}`);
    }
    if (this.size() !== 'md') {
      classes.push(`btn--${this.size()}`);
    }
    if (this.block()) {
      classes.push('btn--block');
    }
    if (this.iconOnly()) {
      classes.push('btn--icon');
    }
    if (this.loading()) {
      classes.push('btn--loading');
    }

    return classes.join(' ');
  });
}
