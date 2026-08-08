import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { passwordStrength } from '../../core/utils/password-strength.util';

/**
 * Password field with a show/hide toggle and an optional strength meter.
 *
 * Details that matter more than they look:
 *
 *   autocomplete   `current-password` on sign-in, `new-password` when setting
 *                  one. Getting this wrong is why password managers offer the
 *                  wrong thing, or nothing at all.
 *   toggle         a real <button> with aria-pressed, not an icon div. It also
 *                  does NOT steal focus from the input.
 *   strength       appears only after the first character. Grading an empty
 *                  field is a form being rude before it has been spoken to.
 *
 * @example
 * <ui-password-field label="Password" autocomplete="current-password"
 *                    formControlName="password" [error]="passwordError()" />
 */
@Component({
  selector: 'ui-password-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-password-field.component.html',
  styleUrl: './ui-password-field.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiPasswordFieldComponent),
      multi: true,
    },
  ],
})
export class UiPasswordFieldComponent implements ControlValueAccessor {
  readonly label = input('Password');
  readonly inputId = input(`password-${Math.random().toString(36).slice(2, 9)}`);
  readonly autocomplete = input<'current-password' | 'new-password'>('current-password');
  readonly helper = input<string>();
  readonly error = input<string | null>(null);
  readonly showStrength = input(false);
  readonly required = input(true);

  /** A link rendered on the label row, e.g. "Forgot password?". */
  readonly hasAction = input(false);

  protected readonly visible = signal(false);
  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  protected readonly strength = computed(() => passwordStrength(this.value()));

  protected readonly describedBy = computed(() => {
    const ids: string[] = [];

    if (this.helper()) ids.push(`${this.inputId()}-helper`);
    if (this.error()) ids.push(`${this.inputId()}-error`);
    if (this.showStrength() && this.value()) ids.push(`${this.inputId()}-strength`);

    return ids.join(' ') || null;
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;

    this.value.set(next);
    this.onChange(next);
  }

  protected onBlur(): void {
    this.onTouched();
  }

  protected toggle(): void {
    this.visible.update((visible) => !visible);
  }
}
