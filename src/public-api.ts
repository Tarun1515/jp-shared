/*==============================================================================
  @tarun1515/jp-shared — THE ONLY ENTRY POINT.

  Four standalone apps (jp-admin, jp-school, jp-teacher, jp-public) consume this
  library through an npm `file:` dependency. Everything they are allowed to use
  is listed below, and nothing else is reachable — ng-packagr publishes a single
  entry point, so `@tarun1515/jp-shared/lib/ui/ui-button/...` does not resolve.

  That is not pedantry. It means the internals stay refactorable without
  breaking four projects, and it is what would make a later move to Native
  Federation cheap: the public surface stays identical and only the loading
  mechanism changes (see PROJECT_MEMORY 2.40).

  ⚠️ jp-shared is a LIBRARY, not an app. No routed components, no login page, no
  environment-specific configuration. Anything an app must configure arrives
  through an injection token — JP_APP_IDENTITY and JP_API_CONFIG below.
==============================================================================*/

// ---- what version is actually loaded ----------------------------------------
// The whole drift mitigation hangs off this. Read the file.
export * from './lib/version';

// ---- app identity and configuration -----------------------------------------
export * from './core/app-identity';

// ---- constants --------------------------------------------------------------
export * from './core/constants/app-constants';
export * from './core/constants/auth-constants';
export * from './core/constants/error-codes';

// ---- models -----------------------------------------------------------------
export * from './core/models/api-response.model';
export * from './core/models/auth.model';
export * from './core/models/lookup.model';
export * from './core/models/menu.model';

// ---- services ---------------------------------------------------------------
export * from './core/services/app-access.service';
export * from './core/services/auth.service';
export * from './core/services/loader.service';
export * from './core/services/master.service';
export * from './core/services/menu.service';
export * from './core/services/toast.service';
export * from './core/services/token-storage.service';

// ---- interceptors -----------------------------------------------------------
export * from './core/interceptors/auth.interceptor';
export * from './core/interceptors/error.interceptor';
export * from './core/interceptors/loader.interceptor';

// ---- guards -----------------------------------------------------------------
export * from './core/guards/active-account.guard';
export * from './core/guards/auth.guard';
export * from './core/guards/permission.guard';
export * from './core/guards/role.guard';

// ---- utils ------------------------------------------------------------------
export * from './core/utils/form.util';
export * from './core/utils/jwt.util';
export * from './core/utils/password-strength.util';

// ---- shared pages and overlay components ------------------------------------
export * from './core/components/confirm-dialog/confirm-dialog.component';
export * from './core/components/confirm-dialog/confirm-dialog.service';
export * from './core/components/loader/loader.component';
export * from './core/components/toast/toast-container.component';
export * from './core/pages/coming-soon/coming-soon.component';
export * from './core/pages/forbidden/forbidden.component';
export * from './core/pages/not-found/not-found.component';

// ---- chrome -----------------------------------------------------------------
// Shared so four apps cannot drift into four different shells.
export * from './ui/ui-app-shell/ui-app-shell.component';
export * from './ui/ui-auth-shell/ui-auth-shell.component';

// ---- design system components -----------------------------------------------
export * from './ui/ui-form-control.base';
export * from './ui/ui-badge/ui-badge.component';
export * from './ui/ui-button/ui-button.component';
export * from './ui/ui-checkbox/ui-checkbox.component';
export * from './ui/ui-datepicker/ui-datepicker.component';
export * from './ui/ui-empty-state/ui-empty-state.component';
export * from './ui/ui-file-upload/ui-file-upload.component';
export * from './ui/ui-input/ui-input.component';
export * from './ui/ui-modal/ui-modal.component';
export * from './ui/ui-multi-select/ui-multi-select.component';
export * from './ui/ui-otp-input/ui-otp-input.component';
export * from './ui/ui-page-header/ui-page-header.component';
export * from './ui/ui-password-field/ui-password-field.component';
export * from './ui/ui-roll/ui-roll.component';
export * from './ui/ui-select/ui-select.component';
export * from './ui/ui-table/ui-table.component';
export * from './ui/ui-textarea/ui-textarea.component';
