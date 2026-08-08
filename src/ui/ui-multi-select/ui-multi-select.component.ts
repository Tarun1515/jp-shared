import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { UiSelectOption } from '../ui-select/ui-select.component';
import { UiFormControlBase } from '../ui-form-control.base';

/**
 * Multi-select with search and removable chips.
 *
 * Used wherever the schema has a bridge table: teacher subjects, class levels,
 * skills, languages, school facilities, job subjects. Many-to-many is never a
 * comma-separated column in this system, and this is its editor.
 *
 * @example
 * <ui-multi-select label="Subjects" [options]="subjectOptions()"
 *                  formControlName="subjectIds" [maxSelections]="8" />
 */
@Component({
  selector: 'ui-multi-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-multi-select.component.html',
  styleUrl: './ui-multi-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiMultiSelectComponent),
      multi: true,
    },
  ],
})
export class UiMultiSelectComponent extends UiFormControlBase<(string | number)[]> {
  readonly options = input<readonly UiSelectOption[]>([]);
  readonly loading = input(false);

  /** Hides the filter box for short lists where it only adds noise. */
  readonly searchable = input(true);

  /** Refuses further selections once reached. 0 means no limit. */
  readonly maxSelections = input(0);

  protected readonly isOpen = signal(false);
  protected readonly search = signal('');

  protected readonly selectedValues = computed(() => this.value() ?? []);

  protected readonly selectedOptions = computed(() => {
    const selected = this.selectedValues();
    return this.options().filter((option) => selected.includes(option.value));
  });

  protected readonly filteredOptions = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) {
      return this.options();
    }
    return this.options().filter((option) => option.label.toLowerCase().includes(term));
  });

  protected readonly atLimit = computed(() => {
    const max = this.maxSelections();
    return max > 0 && this.selectedValues().length >= max;
  });

  protected isSelected(optionValue: string | number): boolean {
    return this.selectedValues().includes(optionValue);
  }

  protected toggleOpen(): void {
    if (this.isDisabled() || this.loading()) {
      return;
    }
    this.isOpen.update((open) => !open);
  }

  protected close(): void {
    this.isOpen.set(false);
    this.markTouched();
  }

  protected toggleOption(optionValue: string | number): void {
    const selected = [...this.selectedValues()];
    const index = selected.indexOf(optionValue);

    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      // Deselecting is always allowed; only adding is capped.
      if (this.atLimit()) {
        return;
      }
      selected.push(optionValue);
    }

    this.commit(selected);
  }

  protected remove(optionValue: string | number, event: Event): void {
    // The chip sits inside the control; without this, removing one would also
    // toggle the dropdown open.
    event.stopPropagation();
    this.toggleOption(optionValue);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected clearAll(event: Event): void {
    event.stopPropagation();
    this.commit([]);
  }
}
