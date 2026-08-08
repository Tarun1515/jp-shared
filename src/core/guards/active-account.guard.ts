import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserStatus } from '../constants/auth-constants';
import { ERROR_CODES } from '../constants/error-codes';
import { AuthService } from '../services/auth.service';

/**
 * Requires an approved account — the client-side mirror of the server's
 * [RequireActiveAccount] filter.
 *
 * Its job is to show the right screen, not to protect anything: the server
 * refuses these endpoints regardless. Without it a pending school would click
 * into a dashboard, watch every panel fail, and be left with a broken page
 * instead of an explanation.
 *
 * Do NOT apply this to the account-status or document-upload routes. Those are
 * exactly where a pending user needs to go.
 */
export const activeAccountGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.currentUser();

  if (!user) {
    return router.createUrlTree(['/auth/login']);
  }

  if (user.status === UserStatus.Active) {
    return true;
  }

  return router.createUrlTree(['/account/status'], {
    queryParams: { code: statusToCode(user.status) },
  });
};

/** Maps a status to the same code the server would have returned. */
function statusToCode(status: UserStatus): string {
  switch (status) {
    case UserStatus.PendingApproval:
      return ERROR_CODES.accountPending;
    case UserStatus.Rejected:
      return ERROR_CODES.accountRejected;
    case UserStatus.Suspended:
      return ERROR_CODES.accountSuspended;
    case UserStatus.Locked:
      return ERROR_CODES.accountLocked;
    case UserStatus.ResubmitRequired:
      return ERROR_CODES.accountResubmitRequired;
    default:
      return ERROR_CODES.accountInactive;
  }
}
