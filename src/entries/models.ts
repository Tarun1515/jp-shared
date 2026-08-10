/*==============================================================================
  jp-shared/models — types, constants and pure functions.

  Exposed over Native Federation. See the note in ./ui.ts about barrels.

  Everything here is stateless: interfaces, enums, frozen constant objects and
  pure helpers. Nothing in this entry point should ever hold state — if it needs
  to, it belongs in jp-shared/core, where the singleton contract applies.
==============================================================================*/

// ---- constants --------------------------------------------------------------
export * from '../core/constants/app-constants';
export * from '../core/constants/auth-constants';
export * from '../core/constants/error-codes';

// ---- models -----------------------------------------------------------------
export * from '../core/models/api-response.model';

// The approval engine's contract. Shared because jp-admin and jp-school are
// two ends of the same flow and must agree on every field.
export * from '../core/models/approval.model';
export * from '../core/models/auth.model';
export * from '../core/models/lookup.model';
export * from '../core/models/menu.model';

// ---- pure utilities ---------------------------------------------------------
export * from '../core/utils/form.util';
export * from '../core/utils/jwt.util';
export * from '../core/utils/password-strength.util';
