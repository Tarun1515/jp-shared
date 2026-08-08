import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ACCOUNT_STATE_CODES, ERROR_CODES } from '../constants/error-codes';
import { ApiResponse } from '../models/api-response.model';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

/**
 * Turns a failed response into something the user can see, then rethrows.
 *
 * It always rethrows: a component that wants to handle its own failure — mark
 * a form field, stay on the page — must still get the error. This only
 * guarantees that nothing fails completely silently.
 *
 * Runs OUTSIDE the auth interceptor, so a 401 that the auth interceptor
 * successfully refreshed away never reaches here.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const toast = inject(ToastService);
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      const envelope = error.error as ApiResponse<unknown> | null;
      const code = envelope?.code ?? null;
      const message = envelope?.message;

      // status 0 is the browser refusing to complete the request at all:
      // server down, DNS failure, CORS rejection, or an offline device.
      if (error.status === 0) {
        toast.error('Cannot reach the server. Check your connection and try again.');
        return throwError(() => error);
      }

      // The account is authenticated but not usable yet. Route to the screen
      // that explains why instead of showing a toast over a page the user
      // should not be on.
      if (code && ACCOUNT_STATE_CODES.includes(code)) {
        void router.navigate(['/account/status'], { queryParams: { code } });
        return throwError(() => error);
      }

      switch (error.status) {
        case 401:
          // Refresh has already been tried and failed by this point.
          auth.clearSession();
          void router.navigate(['/auth/login'], { queryParams: { reason: 'session-expired' } });
          break;

        case 403:
          toast.error(message ?? 'You do not have permission to perform this action.');
          break;

        case 400:
          // Field-level errors belong on the form controls, not in a toast
          // that covers them up. The component renders `errors`.
          if (code !== ERROR_CODES.validationFailed) {
            toast.error(message ?? 'That request could not be completed.');
          }
          break;

        case 404:
          toast.error(message ?? 'That record no longer exists.');
          break;

        case 409:
          toast.warning(
            message ?? 'Someone else changed this record while you were editing. Reload and try again.',
          );
          break;

        case 429:
          toast.warning(message ?? 'Too many attempts. Please wait a moment and try again.');
          break;

        default:
          toast.error(message ?? 'Something went wrong. Please try again.');
          break;
      }

      return throwError(() => error);
    }),
  );
};
