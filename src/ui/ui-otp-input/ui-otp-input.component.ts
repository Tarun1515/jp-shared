import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Six-box one-time-code input.
 *
 * The behaviours below are the ones people notice only when they are missing:
 *
 *   auto-advance   typing moves to the next box
 *   backspace      on an empty box, moves back AND clears the previous one
 *   arrows/home/end   move between boxes
 *   paste          a full code pasted into ANY box fills all six, and
 *                  non-digits are stripped, so pasting "482 913" works
 *   autocomplete   one-time-code on the first box, which is what lets iOS and
 *                  Android offer the SMS code above the keyboard
 *   inputmode      numeric, so a phone shows the number pad
 *
 * The whole thing is one form control: `formControlName="code"` gives the
 * six-character string.
 *
 * @example
 * <ui-otp-input formControlName="code" [invalid]="wrongCode()" (completed)="verify()" />
 */
@Component({
  selector: 'ui-otp-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-otp-input.component.html',
  styleUrl: './ui-otp-input.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiOtpInputComponent),
      multi: true,
    },
  ],
})
export class UiOtpInputComponent implements ControlValueAccessor {
  readonly length = input(6);

  /** Labels the group. Every box also gets its own position label. */
  readonly ariaLabel = input('Verification code');

  readonly invalid = input(false);

  readonly disabled = signal(false);

  /** Fires once the last box is filled — lets the form submit without a click. */
  readonly completed = output<string>();

  protected readonly digits = signal<string[]>([]);

  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly indexes = signal<number[]>([]);

  constructor() {
    // length is an input, so the box list is derived once the first value is
    // known rather than in a field initialiser.
    queueMicrotask(() => {
      this.indexes.set(Array.from({ length: this.length() }, (_, i) => i));
      this.digits.set(Array.from({ length: this.length() }, () => ''));
    });
  }

  // ---- ControlValueAccessor ------------------------------------------------

  writeValue(value: string | null): void {
    const chars = (value ?? '').replace(/\D/g, '').slice(0, this.length()).split('');

    this.digits.set(
      Array.from({ length: this.length() }, (_, i) => chars[i] ?? ''),
    );
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

  // ---- interaction ---------------------------------------------------------

  protected onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;

    // Android soft keyboards can deliver more than one character per event,
    // and some deliver the whole SMS code. Treat anything longer than one
    // character as a paste.
    const typed = input.value.replace(/\D/g, '');

    if (typed.length > 1) {
      this.fillFrom(typed, index);
      return;
    }

    this.setDigit(index, typed);
    input.value = typed;

    if (typed) {
      this.focusBox(index + 1);
    }
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    switch (event.key) {
      case 'Backspace':
        // On an empty box, step back and clear that one too — otherwise the
        // user has to press backspace twice per digit, which feels broken.
        if (!this.digits()[index]) {
          event.preventDefault();
          this.setDigit(index - 1, '');
          this.focusBox(index - 1);
        }
        break;

      case 'ArrowLeft':
        event.preventDefault();
        this.focusBox(index - 1);
        break;

      case 'ArrowRight':
        event.preventDefault();
        this.focusBox(index + 1);
        break;

      case 'Home':
        event.preventDefault();
        this.focusBox(0);
        break;

      case 'End':
        event.preventDefault();
        this.focusBox(this.length() - 1);
        break;

      default:
        break;
    }
  }

  protected onPaste(event: ClipboardEvent, index: number): void {
    const pasted = event.clipboardData?.getData('text') ?? '';
    const clean = pasted.replace(/\D/g, '');

    if (!clean) {
      return;
    }

    event.preventDefault();

    // Pasting a full code into the LAST box should still fill from the start —
    // people paste wherever the cursor happens to be.
    this.fillFrom(clean, clean.length >= this.length() ? 0 : index);
  }

  protected onBlur(): void {
    this.onTouched();
  }

  /** Selects on focus so typing over a filled box replaces rather than appends. */
  protected onFocus(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  // ---- internals -----------------------------------------------------------

  private fillFrom(text: string, start: number): void {
    const next = [...this.digits()];
    let cursor = start;

    for (const char of text) {
      if (cursor >= this.length()) {
        break;
      }

      next[cursor] = char;
      cursor += 1;
    }

    this.digits.set(next);
    this.syncBoxes(next);
    this.emit(next);
    this.focusBox(Math.min(cursor, this.length() - 1));
  }

  private setDigit(index: number, value: string): void {
    if (index < 0 || index >= this.length()) {
      return;
    }

    const next = [...this.digits()];
    next[index] = value;

    this.digits.set(next);
    this.syncBoxes(next);
    this.emit(next);
  }

  private emit(digits: string[]): void {
    const code = digits.join('');

    this.onChange(code);

    if (code.length === this.length()) {
      this.completed.emit(code);
    }
  }

  /**
   * Writes the model back to the DOM.
   *
   * The boxes are uncontrolled — bound with `[value]` they would fight the
   * caret on Android. So the model is the truth and this pushes it out after
   * any change that did not originate from typing in that exact box.
   */
  private syncBoxes(digits: string[]): void {
    this.boxes().forEach((box, index) => {
      box.nativeElement.value = digits[index] ?? '';
    });
  }

  private focusBox(index: number): void {
    const target = this.boxes()[Math.max(0, Math.min(index, this.length() - 1))];

    target?.nativeElement.focus();
    target?.nativeElement.select();
  }
}
