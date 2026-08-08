import { AbstractControl, FormGroup } from '@angular/forms';
import { ApiResponse } from '../models/api-response.model';

/*==============================================================================
  Form plumbing shared by every screen that posts something.

  Two rules are enforced here rather than left to each component to remember,
  because they are the difference between a form that feels considered and one
  that nags:

    VALIDATION APPEARS ON BLUR, NEVER BEFORE A FIELD IS TOUCHED, AND NEVER ON
    EVERY KEYSTROKE. Telling someone their email is invalid while they are
    still typing the domain is a form arguing with its user.

    SERVER ERRORS LAND WHERE THEY BELONG. A field-level error goes next to the
    field; a form-level error goes above the submit; a system failure goes in a
    toast. Never more than one of the three for the same failure.
==============================================================================*/

/** Whether a control should show its error yet. */
export function shouldShowError(control: AbstractControl | null): boolean {
  return !!control && control.invalid && (control.touched || control.dirty === false);
}

/**
 * The one message to show under a field, or null.
 *
 * Messages say what to DO. "Password needs at least 8 characters" is
 * actionable; "Invalid password" makes the user guess, and guessing is the
 * thing forms should never ask for.
 */
export function fieldError(
  control: AbstractControl | null,
  labels: Readonly<Record<string, string>> = {},
): string | null {
  if (!control || !control.errors || !control.touched) {
    return null;
  }

  const errors = control.errors;

  // A server-supplied message always wins: it knows something the client
  // could not, e.g. that this email is already registered.
  if (typeof errors['server'] === 'string') {
    return errors['server'];
  }

  for (const key of Object.keys(errors)) {
    if (labels[key]) {
      return labels[key];
    }
  }

  if (errors['required']) {
    return labels['required'] ?? 'This is required.';
  }

  if (errors['email']) {
    return 'Enter a valid email address.';
  }

  if (errors['minlength']) {
    const required = errors['minlength'].requiredLength as number;
    return `Needs at least ${required} characters.`;
  }

  if (errors['maxlength']) {
    const allowed = errors['maxlength'].requiredLength as number;
    return `Keep this under ${allowed} characters.`;
  }

  if (errors['pattern']) {
    return 'Check the format and try again.';
  }

  return 'Check this and try again.';
}

/**
 * Pushes a failed response onto the form.
 *
 * Returns the message that belongs ABOVE the submit button — either the
 * envelope's own message, or null when every error was field-specific and has
 * already been attached where it belongs. Showing both would say the same
 * thing twice.
 */
export function applyServerErrors(
  form: FormGroup,
  response: ApiResponse<unknown> | null,
): string | null {
  if (!response) {
    return null;
  }

  let attachedAny = false;

  for (const [field, messages] of Object.entries(response.errors ?? {})) {
    // The server names fields in PascalCase; Angular controls are camelCase.
    const name = field.charAt(0).toLowerCase() + field.slice(1);
    const control = form.get(name);

    if (control && messages.length) {
      control.setErrors({ ...(control.errors ?? {}), server: messages[0] });
      control.markAsTouched();
      attachedAny = true;
    }
  }

  return attachedAny ? null : (response.message || 'Something went wrong. Try again.');
}

/**
 * Clears server errors as soon as the user edits the field they were attached
 * to. Leaving "This email is already registered" under a field the user has
 * since changed is a form lying to them.
 */
export function clearServerError(control: AbstractControl | null): void {
  if (!control?.errors?.['server']) {
    return;
  }

  const { server: _removed, ...rest } = control.errors;

  control.setErrors(Object.keys(rest).length ? rest : null);
}

/** Marks everything touched so a submit on an untouched form still reports. */
export function revealErrors(form: FormGroup): void {
  form.markAllAsTouched();
}
