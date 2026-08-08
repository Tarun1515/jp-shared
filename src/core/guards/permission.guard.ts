import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Requires every one of the given permission codes.
 *
 * Prefer this over roleGuard for anything action-shaped. Roles are a bundle of
 * permissions that a school can redefine — a custom role is just a different
 * bundle — so a route guarded on 'JOB.CREATE' keeps working when a school
 * invents a role that happens to include it, whereas one guarded on SENIOR_HR
 * does not.
 *
 * @example
 * canActivate: [authGuard, activeAccountGuard, permissionGuard('JOB.CREATE')]
 */
export function permissionGuard(...permissionCodes: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/auth/login']);
    }

    // AND, not OR: a route that needs two permissions needs both.
    const permitted = permissionCodes.every((code) => auth.hasPermission(code));

    return permitted ? true : router.createUrlTree(['/forbidden']);
  };
}
