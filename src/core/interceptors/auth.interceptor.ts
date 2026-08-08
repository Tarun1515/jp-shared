import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';

/**
 * Endpoints that must NOT carry a bearer token and must never trigger a
 * refresh. Refreshing in response to a failed login would loop forever.
 */
const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register/',
  '/auth/refresh-token',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/send-otp',
  '/auth/verify-otp',
];

/**
 * The refresh currently in flight, shared by every request that hits a 401
 * while it runs.
 *
 * Without this, a screen firing five parallel requests against a just-expired
 * token would start five refreshes. Since the server rotates and revokes on
 * every use, four of them would present an already-revoked token and the user
 * would be logged out — the exact opposite of what refreshing is for.
 */
let refreshInFlight: Observable<string> | null = null;

/**
 * Attaches the access token, and transparently refreshes it once on a 401.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tokenStorage = inject(TokenStorageService);
  const auth = inject(AuthService);
  const router = inject(Router);

  if (isPublicAuthRequest(request)) {
    return next(request);
  }

  const accessToken = tokenStorage.getAccessToken();
  const authorized = accessToken ? withBearer(request, accessToken) : request;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;

      // No refresh token means there is nothing to recover with — the 401 is
      // final and belongs to the error interceptor.
      if (!isUnauthorized || !tokenStorage.getRefreshToken()) {
        return throwError(() => error);
      }

      return refreshThenRetry(request, next, auth, router);
    }),
  );
};

function refreshThenRetry(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  return sharedRefresh(auth).pipe(
    catchError((error: unknown) => {
      // Placed BEFORE switchMap on purpose: this must handle a failed refresh
      // only, not a failure of the retried request itself.
      auth.clearSession();
      void router.navigate(['/auth/login'], {
        queryParams: { returnUrl: router.url, reason: 'session-expired' },
      });
      return throwError(() => error);
    }),
    switchMap((accessToken) => next(withBearer(request, accessToken))),
  );
}

/** One refresh at a time; concurrent callers share the same result. */
function sharedRefresh(auth: AuthService): Observable<string> {
  refreshInFlight ??= auth.refreshToken().pipe(
    map((response) => {
      const accessToken = response.data?.accessToken;
      if (!accessToken) {
        throw new Error('The refresh endpoint returned no access token.');
      }
      return accessToken;
    }),
    finalize(() => {
      refreshInFlight = null;
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  return refreshInFlight;
}

function withBearer(request: HttpRequest<unknown>, accessToken: string): HttpRequest<unknown> {
  return request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } });
}

function isPublicAuthRequest(request: HttpRequest<unknown>): boolean {
  return PUBLIC_AUTH_PATHS.some((path) => request.url.includes(path));
}
