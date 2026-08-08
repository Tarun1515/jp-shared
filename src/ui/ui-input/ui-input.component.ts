import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, forwardRef, input } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { UiFormControlBase } from '../ui-form-control.base';

export type UiInputType = 'text' | 'email' | 'password' | 'tel' | 'number' | 'url' | 'search';

/**
 * Single-line text input with label, helper text and validation state.
 *
 * @example
 * <ui-input label="Email" type="email" formControlName="email"
 *           [error]="emailError()" required />
 */
@Component({
  selector: 'ui-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  templateUrl: './ui-input.component.html',
  styleUrl: './ui-input.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiInputComponent),
      multi: true,
    },
  ],
})
export class UiInputComponent extends UiFormControlBase<string> {
  readonly type = input<UiInputType>('text');

  /**
   * Browser autofill hint. Worth setting on every real field — it is the
   * difference between a form a phone can complete in one tap and one it
   * cannot help with at all.
   */
  readonly autocomplete = input<string>();

  readonly maxlength = input<number>();
  readonly readonly = input(false);

  /** Short text inside the field's leading edge, e.g. a currency symbol. */
  readonly prefix = input<string>();

  /** Short text inside the field's trailing edge, e.g. a unit. */
  readonly suffix = input<string>();

  protected onInput(event: Event): void {
    this.commit((event.target as HTMLInputElement).value);
  }
}
