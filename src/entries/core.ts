/*==============================================================================
  jp-shared/core — services, guards, interceptors, and the configuration tokens.

  Exposed over Native Federation. See the note in ./ui.ts about barrels.

  🔴 These are STATEFUL. TokenStorageService, AuthService and LoaderService hold
  the session and the in-flight request count, so there must be exactly one copy
  of each class in the browser. That is the whole reason @angular/core and
  friends are shared as strict singletons in federation.config.mjs: two Angular
  copies means two InjectionToken classes, which means two AuthServices, which
  means a login that appears to work and a shell that thinks it is signed out.
==============================================================================*/

// ---- app identity and API configuration -------------------------------------
// The tokens every app must provide. JP_APP_IDENTITY decides the storage key
// prefix and which account type the app accepts.
export * from '../core/app-identity';

// ---- services ---------------------------------------------------------------
export * from '../core/services/app-access.service';
export * from '../core/services/auth.service';
export * from '../core/services/loader.service';
export * from '../core/services/master.service';

/*
  SR-4. Every route to the plans goes through this, so that "where they came
  from" is decided in one place — and so a school that upgrades mid-task can
  be put back on the half-finished job it was refused on.
*/
export * from '../core/services/upgrade.service';
export * from '../core/services/menu.service';
export * from '../core/services/toast.service';
export * from '../core/services/return-url.service';
export * from '../core/services/token-storage.service';
export * from '../core/utils/safe-internal-path';
export * from '../core/services/billing.service';
export * from '../core/services/notification.service';
export * from '../core/components/confirm-dialog/confirm-dialog.service';

// ---- interceptors -----------------------------------------------------------
export * from '../core/interceptors/auth.interceptor';
export * from '../core/interceptors/error.interceptor';
export * from '../core/interceptors/loader.interceptor';

// ---- guards -----------------------------------------------------------------
// The menu decides what is SHOWN. These and the server decide what is ALLOWED.
export * from '../core/guards/active-account.guard';
export * from '../core/guards/auth.guard';
export * from '../core/guards/permission.guard';
export * from '../core/guards/role.guard';

// Not about permission at all: this one stops a navigation that would discard
// what somebody has typed. Added in 3F, when the school profile became long
// enough that losing it mattered.
export * from '../core/guards/unsaved-changes.guard';
