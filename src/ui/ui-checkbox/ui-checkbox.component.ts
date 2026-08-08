import { ChangeDetectionStrategy, Component, forwardRef, input } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { UiFormControlBase } from '../ui-form-control.base';

/**
 * A single checkbox with its label.
 *
 * The label text is projected rather than passed as an input, so it can carry
 * a link — "I accept the [terms]" is a real requirement and would otherwise
 * need markup in a string.
 *
 * @example
 * <ui-checkbox formControlName="acceptTerms" [error]="termsError()">
 *   I accept the <a routerLink="/terms">terms of use</a>
 * </ui-checkbox>
 */
@Component({
  selector: 'ui-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-checkbox.component.html',
  styleUrl: './ui-checkbox.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiCheckboxComponent),
      multi: true,
    },
  ],
})
export class UiCheckboxComponent extends UiFormControlBase<boolean> {
  /** Renders a radio instead. Requires a shared `name` across the group. */
  readonly asRadio = input(false);

  readonly name = input<string>();

  protected onToggle(event: Event): void {
    this.commit((event.target as HTMLInputElement).checked);
  }
}
