import {
  ChangeDetectionStrategy, Component, ElementRef, computed, forwardRef, input, signal, viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { UiFormControlBase } from '../ui-form-control.base';
import { UiSelectOption } from '../ui-select/ui-select.component';

/**
 * A searchable single-select — one component, used everywhere a master feeds
 * a dropdown.
 *
 * ----------------------------------------------------------------------------
 * 🔴 WHY THIS EXISTS, AND WHY IT IS NOT A SECOND SELECT
 * ----------------------------------------------------------------------------
 * SR-1 seeded 143 Haryana towns, and will seed every other state's in time. A
 * native `<select>` with 143 options is a list somebody scrolls, and the only
 * way to reach "Nathusari Chopta" is to know roughly where N falls. Subject
 * and qualification lists have the same problem at smaller scale.
 *
 * ⚠️ IT TAKES THE SAME `UiSelectOption[]` AS `<ui-select>`, deliberately. A
 * drop-in swap is a tag change, which is what makes "replace every plain
 * select over master data" a change somebody can actually finish — and G27 is
 * the standing instruction that there is ONE such component, not one per app.
 *
 * ----------------------------------------------------------------------------
 * ⚠️ WHAT IT IS NOT
 * ----------------------------------------------------------------------------
 * It is not free text. The value committed is always an option's `value`, or
 * null. Somebody typing a town we do not have gets nothing selected — which is
 * correct, and is why SR-1's address form keeps a free-text
 * `AreaOrVillage` beside it rather than letting this invent a row.
 *
 * @example
 * <ui-combobox label="City" [options]="cityOptions()" formControlName="cityId" />
 */
@Component({
  selector: 'ui-combobox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-combobox.component.html',
  styleUrl: './ui-combobox.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiComboboxComponent),
      multi: true,
    },
  ],
})
export class UiComboboxComponent extends UiFormControlBase<string | number> {
  readonly options = input<readonly UiSelectOption[]>([]);

  readonly placeholderOption = input('Type to search…');

  readonly loading = input(false);

  /**
   * How many options before the list is worth searching at all.
   *
   * ⚠️ Below this the component still works — it just opens showing
   * everything, which for six subjects is the whole point. A search box over
   * four options is a worse control than the four options.
   */
  readonly searchFrom = input(8);

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(-1);

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  /** The chosen option, if the current value matches one. */
  protected readonly selected = computed(() =>
    this.options().find((o) => o.value === this.value()) ?? null);

  protected readonly searchable = computed(() => this.options().length >= this.searchFrom());

  /**
   * What the list shows.
   *
   * ⚠️ MATCHES ANYWHERE IN THE LABEL, not just the start. Somebody looking for
   * "Nathusari Chopta" may well type "chopta", and a prefix match would show
   * them nothing while the row sits in the list.
   */
  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();

    if (!q) {
      return this.options();
    }

    return this.options().filter((o) => o.label.toLowerCase().includes(q));
  });

  /** What the closed control reads as. */
  protected readonly display = computed(() =>
    this.open() ? this.query() : this.selected()?.label ?? '');

  protected readonly listId = `${this.controlId}-list`;

  protected optionId(index: number): string {
    return `${this.listId}-opt-${index}`;
  }

  protected onFocus(): void {
    this.open.set(true);
    this.query.set('');

    /*
      ⚠️ THE ACTIVE ROW STARTS ON THE CURRENT VALUE, not at the top. Reopening
      a filled control and pressing Enter must not silently change it to the
      first option in the list.
    */
    this.activeIndex.set(this.visible().findIndex((o) => o.value === this.value()));
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.open.set(true);
    this.activeIndex.set(this.visible().length ? 0 : -1);
  }

  /**
   * Closing without choosing.
   *
   * 🔴 THE VALUE IS NOT CLEARED HERE. Typing two letters and clicking away
   * must leave the previously chosen option alone — the query is scratch
   * state, not the value. The input is redrawn from `display()`, so it snaps
   * back to the selected label on its own.
   */
  protected onBlur(): void {
    this.open.set(false);
    this.query.set('');
    this.activeIndex.set(-1);
    this.markTouched();
  }

  protected choose(option: UiSelectOption): void {
    if (option.disabled) {
      return;
    }

    this.commit(option.value);
    this.open.set(false);
    this.query.set('');
    this.field()?.nativeElement.blur();
  }

  protected clear(): void {
    this.commit(null);
    this.query.set('');
    this.open.set(false);
  }

  protected onKey(event: KeyboardEvent): void {
    const list = this.visible();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.open.set(true);
        this.activeIndex.set(list.length ? (this.activeIndex() + 1) % list.length : -1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.open.set(true);
        this.activeIndex.set(list.length ? (this.activeIndex() - 1 + list.length) % list.length : -1);
        break;

      case 'Enter': {
        /*
          ⚠️ preventDefault ONLY when this control is actually using the key.
          Swallowing Enter unconditionally would stop a one-field form being
          submitted from the keyboard, which is a thing people do.
        */
        const active = list[this.activeIndex()];

        if (this.open() && active) {
          event.preventDefault();
          this.choose(active);
        }

        break;
      }

      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.open.set(false);
          this.query.set('');
        }

        break;

      default:
        break;
    }
  }
}
