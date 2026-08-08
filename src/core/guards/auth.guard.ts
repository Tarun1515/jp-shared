import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Requires a signed-in user.
 *
 * Deliberately checks only that a session exists, not that it is approved —
 * see activeAccountGuard for that. Keeping the two apart is what lets a
 * pending school reach its status and document-upload screens.
 *
 * These guards are a routing convenience, not a security control. Every guard
 * here reads an unverified client-side copy of the token's claims; the server
 * re-derives all of it from the signed token and is the only thing actually
 * enforcing access.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // returnUrl brings them back where they were headed after signing in.
  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/** Keeps a signed-in user off the login and registration pages. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() ? router.parseUrl(auth.homeRoute()) : true;
};
