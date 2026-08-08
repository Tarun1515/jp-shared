import { ChangeDetectionStrategy, Component, forwardRef, input } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { UiFormControlBase } from '../ui-form-control.base';

/**
 * Date field.
 *
 * Built on the native `<input type="date">` deliberately. The browser's own
 * picker is fully keyboard accessible, localised to the user's locale, and on
 * a phone it opens the platform date wheel — none of which a hand-rolled
 * calendar gets for free.
 *
 * The value travels as an ISO `yyyy-MM-dd` string, which is what the native
 * input speaks and what SQL Server's `date` type accepts without conversion.
 * A JavaScript `Date` would drag in timezone shifts that turn a date of birth
 * into the previous day for anyone east of UTC.
 *
 * @example
 * <ui-datepicker label="Joining date" formControlName="joiningDate" [min]="today" />
 */
@Component({
  selector: 'ui-datepicker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-datepicker.component.html',
  styleUrl: './ui-datepicker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiDatepickerComponent),
      multi: true,
    },
  ],
})
export class UiDatepickerComponent extends UiFormControlBase<string> {
  /** Earliest selectable date, ISO `yyyy-MM-dd`. */
  readonly min = input<string>();

  /** Latest selectable date, ISO `yyyy-MM-dd`. */
  readonly max = input<string>();

  readonly readonly = input(false);

  /** Renders `datetime-local` instead — for interview slots and the like. */
  readonly withTime = input(false);

  protected onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.commit(raw === '' ? null : raw);
  }
}
