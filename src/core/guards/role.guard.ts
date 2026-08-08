import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Requires at least one of the given role codes.
 *
 * A factory rather than a plain guard, so the roles are declared at the route:
 *
 * @example
 * {
 *   path: 'branches',
 *   canActivate: [authGuard, activeAccountGuard, roleGuard(ROLE_CODES.schoolOwner)],
 *   loadComponent: () => import('./branches/branches').then(m => m.Branches),
 * }
 */
export function roleGuard(...roleCodes: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/auth/login']);
    }

    // Redirected rather than shown a 403 page: the user is legitimately signed
    // in, they simply took a link meant for a different role.
    return auth.hasRole(...roleCodes) ? true : router.createUrlTree(['/forbidden']);
  };
}
