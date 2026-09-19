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
/**
 * Codes whose message is written by the screen that asked, not by this file.
 *
 * ⚠️ Adding a code here is a promise that SOME component renders it. An
 * unhandled code on this list fails silently, which is the one thing this
 * interceptor exists to prevent — so the entry and the component that handles
 * it belong in the same commit.
 */
const COMPONENT_RENDERED_CODES = new Set<string>([
  ERROR_CODES.validationFailed,

  // Phase 4B — the jobs list explains these, with the reset timing and the
  // fact that the job is safe as a draft. See jobRefusalMessage().
  'QUOTA_EXHAUSTED',
  'PLAN_LACKS_FEATURE',
  'FEATURE_DISABLED',
  'JOB_FIELD_LOCKED',

  /*
    Phase 5B — the teacher's apply panel renders these two IN PLACE, beside the
    Apply button, because each has a next step that a toast cannot carry:
    RESUME_REQUIRED links straight to the resume section of the profile, and
    JOB_EXPIRED replaces the button with the date applications closed.

    ⚠️ DELIBERATELY ONLY THESE TWO of the six application codes. The others are
    NOT rendered by any component and must keep their toast:

      ALREADY_APPLIED          never arrives here at all — Status 1, HTTP 200
      APPLY_CONFLICT           retryable, says nothing about the user
      INVALID_TRANSITION       only reachable by forcing a request the UI does
      OFFER_STAGE_UNAVAILABLE  not offer; the same

    Listing a code here that no component renders is how a refusal becomes
    silence, which is the one thing this interceptor exists to prevent.
  */
  'RESUME_REQUIRED',
  'JOB_EXPIRED',
]);

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
          // ⚠️ Same rule as the 400 branch below. FEATURE_DISABLED arrives as a
          // 403 — it is an operator decision, not a permission — and the jobs
          // screen has a better sentence for it than "you do not have
          // permission", which would be actively misleading.
          if (!COMPONENT_RENDERED_CODES.has(code ?? '')) {
            toast.error(message ?? 'You do not have permission to perform this action.');
          }
          break;

        case 400:
          /*
            Field-level errors belong on the form controls, not in a toast that
            covers them up. The component renders `errors`.

            ⚠️ Phase 4B extended the same reasoning to the entitlement refusals.
            A component that renders a code ITSELF must not also be toasted at,
            or the person gets two messages for one event — which is exactly
            what happened the first time the quota refusal was shown: the
            server's sentence and the screen's fuller one, stacked.

            🔴 These codes stay off this list only if no screen handles them.
            The rule is "whoever says it best says it once" — and for a quota
            refusal that is the screen, because it can add when the allowance
            resets and that the job is safe as a draft.
          */
          if (!COMPONENT_RENDERED_CODES.has(code ?? '')) {
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
