/*==============================================================================
  jp-shared/ui — design system components and chrome.

  Exposed over Native Federation. Hosts import it as `jp-shared/ui`, which is
  an IMPORT MAP entry, not a package: the specifier is left external by the
  host's build and resolved in the browser to a bundle served by jp-shared on
  :4999. Nothing is copied into the host, which is why editing a component here
  shows up in an app on reload with no build step in the app.

  ⚠️ Keep this a barrel of re-exports only. Native Federation can only share a
  mapped path through its barrel; a host reaching past it (`jp-shared/ui/...`)
  is not an import map entry and will fail to resolve at runtime.
==============================================================================*/

// ---- chrome -----------------------------------------------------------------
// Shared so four apps cannot drift into four different shells.
export * from '../ui/ui-app-shell/ui-app-shell.component';
export * from '../ui/ui-auth-shell/ui-auth-shell.component';

// ---- form control base ------------------------------------------------------
export * from '../ui/ui-form-control.base';

// ---- design system components -----------------------------------------------
export * from '../ui/ui-badge/ui-badge.component';
export * from '../ui/ui-billing-page/ui-billing-page.component';
export * from '../ui/ui-button/ui-button.component';
export * from '../ui/ui-checkbox/ui-checkbox.component';

/*
  SR-3 (G27). ONE searchable select for the whole product. SR-1 seeded 143
  Haryana towns and will seed every other state in time; a native <select>
  with 143 options is a list you can only use if you know where N falls.

  ⚠️ It takes the same UiSelectOption[] as <ui-select>, so replacing a plain
  select over master data is a tag change — which is what makes doing it
  everywhere a job somebody can finish.
*/
export * from '../ui/ui-combobox/ui-combobox.component';
export * from '../ui/ui-datepicker/ui-datepicker.component';
export * from '../ui/ui-empty-state/ui-empty-state.component';
export * from '../ui/ui-file-upload/ui-file-upload.component';
export * from '../ui/ui-input/ui-input.component';
export * from '../ui/ui-modal/ui-modal.component';
export * from '../ui/ui-multi-select/ui-multi-select.component';

/*
  ⚠️ Exported even though the shell mounts it itself, because a screen may want
  the panel somewhere else later — and a component reachable only through
  another component's template is a component nobody can find.
*/
export * from '../ui/ui-notification-bell/ui-notification-bell.component';

/*
  🔴 The full page both portals route AT, directly. The seeded
  SCHOOL_NOTIFICATIONS and TEACHER_NOTIFICATIONS rows point at /notifications in
  each app, and both load this — rather than each wrapping it, which is where
  two copies would start to disagree (G27).
*/
export * from '../ui/ui-notification-list/ui-notification-list.component';
export * from '../ui/ui-otp-input/ui-otp-input.component';
export * from '../ui/ui-page-header/ui-page-header.component';
export * from '../ui/ui-password-field/ui-password-field.component';
export * from '../ui/ui-roll/ui-roll.component';
export * from '../ui/ui-select/ui-select.component';
export * from '../ui/ui-table/ui-table.component';
export * from '../ui/ui-textarea/ui-textarea.component';

// ---- overlay components -----------------------------------------------------
// Rendered once by the app shell, driven by the services in jp-shared/core.
export * from '../core/components/confirm-dialog/confirm-dialog.component';
export * from '../core/components/loader/loader.component';
export * from '../core/components/toast/toast-container.component';
