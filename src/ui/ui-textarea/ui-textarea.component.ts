import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { UiFormControlBase } from '../ui-form-control.base';

/**
 * Multi-line text input.
 *
 * @example
 * <ui-textarea label="About your school" [rows]="6" [maxlength]="2000"
 *              formControlName="aboutSchool" showCount />
 */
@Component({
  selector: 'ui-textarea',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-textarea.component.html',
  styleUrl: './ui-textarea.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiTextareaComponent),
      multi: true,
    },
  ],
})
export class UiTextareaComponent extends UiFormControlBase<string> {
  readonly rows = input(4);
  readonly maxlength = input<number>();
  readonly readonly = input(false);

  /** Shows a live "n / max" counter. Requires `maxlength`. */
  readonly showCount = input(false);

  protected readonly charCount = computed(() => this.value()?.length ?? 0);

  /** Warn before the limit, not at it — hitting it silently is the surprise. */
  protected readonly nearLimit = computed(() => {
    const max = this.maxlength();
    return max !== undefined && this.charCount() > max * 0.9;
  });

  protected onInput(event: Event): void {
    this.commit((event.target as HTMLTextAreaElement).value);
  }
}
