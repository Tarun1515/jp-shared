import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { UiSelectOption } from '../ui-select/ui-select.component';
import { UiFormControlBase } from '../ui-form-control.base';

/**
 * Multi-select with search, keyboard navigation and removable chips.
 *
 * Used wherever the schema has a bridge table: teacher subjects, class levels,
 * skills, preferred locations, school facilities, job subjects. Many-to-many is
 * never a comma-separated column in this system, and this is its editor.
 *
 * ----------------------------------------------------------------------------
 * 🔴 REBUILT IN 3H, AND WHY
 * ----------------------------------------------------------------------------
 * Five sections of the teacher profile depend on this one control, so the cost
 * of every flaw in it is multiplied by five. Four things were wrong, and none
 * of them would have been noticed by looking at it:
 *
 *   NESTED INTERACTIVE ELEMENTS. The chips' remove buttons and the clear button
 *     lived INSIDE the trigger `<button>`. That is invalid HTML, and in practice
 *     a screen reader reads the whole thing as one control while Space on a chip
 *     activates the button it is sitting in. The chips are now siblings of the
 *     trigger, and each is a real `<button>`.
 *
 *   NO KEYBOARD NAVIGATION. Options were divs with tabindex=0, so reaching the
 *     fortieth subject meant forty Tab presses. Arrow keys move an active option
 *     now, with aria-activedescendant, which is how a listbox is meant to work.
 *
 *   IT NEVER CLOSED. Only Escape closed the panel — click anywhere else and it
 *     stayed open, overlapping the next field. On a form with five of them, two
 *     panels could be open at once.
 *
 *   TWENTY SELECTIONS BROKE THE LAYOUT. Chips lived inside the trigger, so the
 *     control grew into a wall of pills and pushed everything down the page. The
 *     trigger now summarises ("6 selected") and the chips wrap underneath, where
 *     they can be as many as they like.
 *
 * @example
 * <ui-multi-select label="Subjects you teach" [options]="subjectOptions()"
 *                  formControlName="subjectIds" [maxSelections]="8" />
 */
@Component({
  selector: 'ui-multi-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-multi-select.component.html',
  styleUrl: './ui-multi-select.component.scss',
  host: {
    // Closing on an outside click is the behaviour people expect from every
    // dropdown they have ever used; the old version only closed on Escape.
    '(document:click)': 'onDocumentClick($event)',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiMultiSelectComponent),
      multi: true,
    },
  ],
})
export class UiMultiSelectComponent extends UiFormControlBase<(string | number)[]> {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input<readonly UiSelectOption[]>([]);
  readonly loading = input(false);

  /** Hides the filter box for short lists where it only adds noise. */
  readonly searchable = input(true);

  /** Refuses further selections once reached. 0 means no limit. */
  readonly maxSelections = input(0);

  /**
   * What one selection is called, for the summary and the announcements.
   * "subject" gives "6 subjects selected".
   */
  readonly itemNoun = input('');

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly isOpen = signal(false);
  protected readonly search = signal('');

  /**
   * Which option the arrow keys are on.
   *
   * ⚠️ Not the same as focus. Focus stays in the search box so typing keeps
   * working; the listbox's active option is communicated with
   * aria-activedescendant, which is the pattern a screen reader expects here.
   */
  protected readonly activeIndex = signal(0);

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

  /**
   * What the trigger says.
   *
   * 🔴 A COUNT, not the selections. With twenty subjects chosen, listing them
   * here would make the control taller than the section it is in — which is
   * exactly what it used to do. The chips below say WHICH; this says HOW MANY.
   */
  protected readonly summary = computed(() => {
    const count = this.selectedOptions().length;

    if (this.loading()) return 'Loading…';
    if (count === 0) return this.placeholder() || 'Select…';
    if (count === 1) return this.selectedOptions()[0].label;

    const noun = this.itemNoun();

    return noun ? `${count} ${noun}s selected` : `${count} selected`;
  });

  protected readonly listboxId = `${this.controlId}-listbox`;

  protected optionId(index: number): string {
    return `${this.controlId}-option-${index}`;
  }

  protected readonly activeOptionId = computed(() => {
    const options = this.filteredOptions();
    const index = this.activeIndex();

    return options.length > 0 && index < options.length ? this.optionId(index) : null;
  });

  constructor() {
    super();

    // Focus follows the panel: opening puts the cursor in the search box, so
    // somebody can start typing immediately instead of reaching for the mouse.
    effect(() => {
      if (this.isOpen()) {
        queueMicrotask(() => this.searchInput()?.nativeElement.focus());
      }
    });
  }

  protected isSelected(optionValue: string | number): boolean {
    return this.selectedValues().includes(optionValue);
  }

  protected open(): void {
    if (this.isDisabled() || this.loading()) return;

    this.isOpen.set(true);
    this.activeIndex.set(0);
  }

  protected toggleOpen(): void {
    this.isOpen() ? this.close() : this.open();
  }

  protected close(returnFocus = false): void {
    if (!this.isOpen()) return;

    this.isOpen.set(false);
    this.search.set('');
    this.markTouched();

    if (returnFocus) {
      // Escape and Enter put focus back where the person left it. Without this,
      // closing the panel drops focus onto <body> and the next Tab starts from
      // the top of the page.
      this.host.nativeElement.querySelector<HTMLButtonElement>('.multi__control')?.focus();
    }
  }

  protected onDocumentClick(event: Event): void {
    if (!this.isOpen()) return;

    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected toggleOption(optionValue: string | number): void {
    const selected = [...this.selectedValues()];
    const index = selected.indexOf(optionValue);

    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      // Deselecting is always allowed; only adding is capped.
      if (this.atLimit()) return;

      selected.push(optionValue);
    }

    this.commit(selected);
  }

  /**
   * Removes one selection from its chip.
   *
   * ⚠️ The chips are OUTSIDE the trigger now, so there is no event to stop from
   * bubbling into it — which is what the old stopPropagation was for, and what
   * made the whole thing invalid HTML in the first place.
   */
  protected remove(optionValue: string | number): void {
    this.toggleOption(optionValue);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);

    // The list under the cursor just changed, so the active option has to come
    // back to the top or it points at something no longer shown.
    this.activeIndex.set(0);
  }

  protected clearAll(): void {
    this.commit([]);
  }

  /**
   * Arrow keys, Enter, Escape, Home and End.
   *
   * Handled on the search box because that is where focus is while the panel is
   * open. The active option is a value, not focus, so typing and navigating do
   * not fight over the caret.
   */
  protected onSearchKeydown(event: KeyboardEvent): void {
    const options = this.filteredOptions();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update((i) => (options.length === 0 ? 0 : (i + 1) % options.length));
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update((i) =>
          options.length === 0 ? 0 : (i - 1 + options.length) % options.length,
        );
        break;

      case 'Home':
        event.preventDefault();
        this.activeIndex.set(0);
        break;

      case 'End':
        event.preventDefault();
        this.activeIndex.set(Math.max(0, options.length - 1));
        break;

      case 'Enter': {
        event.preventDefault();

        const option = options[this.activeIndex()];
        if (option && !option.disabled) {
          this.toggleOption(option.value);
        }

        break;
      }

      case 'Escape':
        event.preventDefault();
        this.close(true);
        break;

      case 'Tab':
        // Leaving the control closes it. Not preventDefault — Tab should still
        // move on; trapping focus in a dropdown is a trap.
        this.close();
        break;

      default:
        break;
    }
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.open();
    }
  }
}
