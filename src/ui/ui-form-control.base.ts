import { Directive, computed, input, signal } from '@angular/core';
import { ControlValueAccessor } from '@angular/forms';

let nextControlId = 0;

/**
 * Shared behaviour for every form control in the UI library.
 *
 * Abstract, and decorated with a selector-less `@Directive()` so Angular still
 * processes the `input()` declarations on it — a plain base class would have
 * its inputs silently ignored.
 *
 * Handles the parts that are identical for every control and easy to get
 * subtly wrong per component: ControlValueAccessor plumbing, the id wiring
 * between label / control / helper / error, and combining the two independent
 * sources of "disabled".
 */
@Directive()
export abstract class UiFormControlBase<T> implements ControlValueAccessor {
  /** Visible label. Always supply one — a placeholder is not a label. */
  readonly label = input<string>();

  readonly placeholder = input('');

  /** Guidance shown under the control. */
  readonly helper = input<string>();

  /**
   * Validation message. Its presence is what puts the control into the invalid
   * state, so the visual state and `aria-invalid` can never disagree.
   */
  readonly error = input<string>();

  readonly required = input(false);

  /** Template-driven disable. Reactive forms use setDisabledState instead. */
  readonly disabled = input(false);

  readonly value = signal<T | null>(null);

  /** Set by Angular forms via setDisabledState. */
  private readonly formDisabled = signal(false);

  /**
   * Either source disables the control. Kept separate because a reactive form
   * calling `disable()` must not be undone by the input's default of false.
   */
  readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  readonly hasError = computed(() => !!this.error());

  /** Unique, stable ids so label/helper/error can reference the control. */
  protected readonly controlId = `ui-control-${++nextControlId}`;
  protected readonly helperId = `${this.controlId}-helper`;
  protected readonly errorId = `${this.controlId}-error`;

  /**
   * What `aria-describedby` should point at. Both may apply at once, and an
   * empty string would announce a phantom description, so it resolves to null.
   */
  protected readonly describedBy = computed(() => {
    const ids: string[] = [];

    if (this.helper()) {
      ids.push(this.helperId);
    }
    if (this.error()) {
      ids.push(this.errorId);
    }

    return ids.length > 0 ? ids.join(' ') : null;
  });

  protected onChange: (value: T | null) => void = () => {
    // Replaced by registerOnChange when bound to a form.
  };

  protected onTouched: () => void = () => {
    // Replaced by registerOnTouched when bound to a form.
  };

  writeValue(value: T | null): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  /** Updates local state and notifies the form in one step. */
  protected commit(value: T | null): void {
    this.value.set(value);
    this.onChange(value);
  }

  protected markTouched(): void {
    this.onTouched();
  }
}
