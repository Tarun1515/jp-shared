import { CanDeactivateFn } from '@angular/router';

/**
 * A screen that can lose work if it is navigated away from.
 *
 * Implemented by the component; the guard below asks it, and only it knows
 * whether anything is actually dirty.
 */
export interface HasUnsavedChanges {
  /** True when leaving now would discard something the user typed. */
  hasUnsavedChanges(): boolean;

  /**
   * Optional. What to warn about, when "you have unsaved changes" is too vague
   * to act on — e.g. naming the section that is dirty.
   */
  unsavedChangesMessage?(): string;
}

const DEFAULT_MESSAGE =
  'You have changes that have not been saved. Leave this page and lose them?';

/**
 * Stops a navigation that would throw away unsaved edits.
 *
 * ----------------------------------------------------------------------------
 * WHY `confirm()` AND NOT THE DESIGN SYSTEM'S DIALOG
 * ----------------------------------------------------------------------------
 * ConfirmDialogService is the right control everywhere else, and it is wrong
 * here for one specific reason: a router guard has to answer synchronously to
 * cancel a navigation that is ALREADY IN FLIGHT — including the browser's own
 * back button, which does not wait for a promise. A pretty dialog that resolves
 * after the route has changed is a dialog asking about a page the user has
 * already left.
 *
 * So this is the one place the native dialog is the correct tool. It is also
 * the one the browser itself uses for a tab close, which means the two
 * behaviours a user meets — closing the tab and navigating away — look the same
 * rather than one being a system prompt and the other a styled box.
 *
 * @example
 * { path: 'profile', component: ProfileComponent, canDeactivate: [unsavedChangesGuard] }
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component?.hasUnsavedChanges?.()) {
    return true;
  }

  const message = component.unsavedChangesMessage?.() ?? DEFAULT_MESSAGE;

  return window.confirm(message);
};
