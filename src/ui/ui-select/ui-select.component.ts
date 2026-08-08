import { ChangeDetectionStrategy, Component, forwardRef, input } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Lookup } from '../../core/models/lookup.model';
import { UiFormControlBase } from '../ui-form-control.base';

/** One option in a select. */
export interface UiSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

/**
 * Maps master data straight onto select options.
 *
 * Every dropdown in this application is fed from a master table through
 * MasterService — nothing is hardcoded in a component — so this conversion is
 * the normal path from `MasterService.get()` to `<ui-select>`.
 */
export function lookupsToOptions(lookups: readonly Lookup[]): UiSelectOption[] {
  return lookups.map((lookup) => ({ value: lookup.id, label: lookup.name }));
}

/**
 * Single-select dropdown.
 *
 * @example
 * <ui-select label="Board" [options]="boardOptions()" formControlName="boardId" required />
 */
@Component({
  selector: 'ui-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-select.component.html',
  styleUrl: './ui-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiSelectComponent),
      multi: true,
    },
  ],
})
export class UiSelectComponent extends UiFormControlBase<string | number> {
  readonly options = input<readonly UiSelectOption[]>([]);

  /** Text for the empty option. Hidden entirely when the field is required. */
  readonly placeholderOption = input('Select…');

  /** Shows a loading hint while the master data is still being fetched. */
  readonly loading = input(false);

  protected onSelect(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;

    if (raw === '') {
      this.commit(null);
      return;
    }

    // A <select> value is always a string. Numeric master ids must go back to
    // the form as numbers, or an id comparison downstream quietly fails.
    const matched = this.options().find((option) => String(option.value) === raw);
    this.commit(matched ? matched.value : raw);
  }
}
