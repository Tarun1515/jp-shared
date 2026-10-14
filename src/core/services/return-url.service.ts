import { Injectable, inject } from '@angular/core';
import { JP_APP_IDENTITY, scopedStorageKey } from '../app-identity';
import { STORAGE_KEYS } from '../constants/auth-constants';
import { safeInternalPath } from '../utils/safe-internal-path';

/*==============================================================================
  WHERE WAS THIS PERSON HEADED BEFORE WE ASKED THEM TO SIGN IN?

  ----------------------------------------------------------------------------
  🔴 THIS COMPLETES SOMETHING HALF-BUILT, AND THE HALF THAT EXISTED WAS A
  COMMENT CLAIMING IT WORKED
  ----------------------------------------------------------------------------
  Two places already WRITE a returnUrl, and until 7B-0 nothing anywhere READ
  one — not in this library, not in any of the three apps:

      auth.guard.ts        queryParams: { returnUrl: state.url }
                           with the comment "returnUrl brings them back where
                           they were headed after signing in"

      auth.interceptor.ts  queryParams: { returnUrl: router.url,
                                          reason: 'session-expired' }

  So a teacher whose session expired halfway through an application was sent to
  /auth/login?returnUrl=/applications/42 and landed on the dashboard, while the
  guard's comment said otherwise. Measured rather than assumed: a grep for
  returnUrl across jp-shared, jp-teacher, jp-school and jp-admin found three
  hits, every one of them a write.

  7B-0 needed exactly this mechanism for the public site's Apply button (G41).
  Adding a SECOND parameter beside one that already existed and did nothing
  would have been the worse of the two mistakes available.

  ----------------------------------------------------------------------------
  ⚠️ WHY IT IS STORED RATHER THAN PASSED ALONG
  ----------------------------------------------------------------------------
  The funnel it was built for has three hops:

      /auth/register?returnUrl=/jobs/<uid>/apply
        -> register succeeds and signs in behind the scenes
        -> lands on the job

  Threading a query parameter through every intermediate navigation means every
  one has to remember to forward it, and the one that forgets is the one nobody
  notices. Captured once at the door and consumed once at the end, there is
  nothing in between to forget.

  ⚠️ sessionStorage, not localStorage — unlike the tokens. A pending
  destination belongs to one visit: somebody who closed the browser two days
  ago should land on their dashboard, not be dropped into a half-started
  application.

  🔒 The validation lives in utils/safe-internal-path.ts, which has no Angular
  imports so that it can be table-tested directly. A security check whose only
  test is end-to-end gets tested on the two cases somebody thought of.
==============================================================================*/

@Injectable({ providedIn: 'root' })
export class ReturnUrlService {
  private readonly identity = inject(JP_APP_IDENTITY);

  private readonly key = scopedStorageKey(STORAGE_KEYS.returnUrl, this.identity.key);

  /**
   * Validate and store a candidate, usually straight from the URL.
   *
   * ⚠️ A REJECTED CANDIDATE IS NOT AN ERROR AND CLEARS NOTHING. Arriving at
   * /auth/login with no parameter is the normal case, and a crafted one is
   * simply ignored — there is nothing useful to tell the visitor, and a message
   * naming the rule helps only whoever was probing it.
   *
   * @returns the stored path, or null when there was nothing safe to store.
   */
  capture(candidate: string | null | undefined): string | null {
    const safe = safeInternalPath(candidate);

    if (!safe) {
      return null;
    }

    this.write(safe);

    return safe;
  }

  /**
   * The pending destination, without clearing it.
   *
   * 🔒 VALIDATED ON THE WAY OUT AS WELL AS IN. Storage is readable and writable
   * by any script on the page, so a value that was safe when written is not
   * automatically safe when read — and this is the half an attacker with an XSS
   * foothold would reach for.
   */
  peek(): string | null {
    return safeInternalPath(this.read());
  }

  /**
   * The pending destination, and forget it.
   *
   * 🔴 CLEARED EVEN WHEN INVALID, so a value that cannot be used cannot sit in
   * storage being re-read on every later sign-in.
   */
  consume(): string | null {
    const pending = this.peek();

    this.clear();

    return pending;
  }

  clear(): void {
    try {
      sessionStorage.removeItem(this.key);
    } catch {
      /* Storage disabled, or Safari in private mode. Nothing to undo. */
    }
  }

  private read(): string | null {
    try {
      return sessionStorage.getItem(this.key);
    } catch {
      return null;
    }
  }

  private write(value: string): void {
    try {
      sessionStorage.setItem(this.key, value);
    } catch {
      /*
        The funnel degrades to landing on the home route — where it landed
        before any of this existed. Not worth telling anybody about.
      */
    }
  }
}
