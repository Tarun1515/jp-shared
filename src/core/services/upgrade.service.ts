import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ReturnUrlService } from './return-url.service';

/**
 * "Show me the plans" — from wherever the user hit a wall.
 *
 * ----------------------------------------------------------------------------
 * 🔴 WHY A SERVICE AND NOT A routerLink
 * ----------------------------------------------------------------------------
 * A plain link to `/billing` loses the one fact that matters: what the person
 * was doing. They hit a quota wall posting their second job, go and read the
 * plans, and then have to find their way back to a half-finished job — and
 * most will not. The upgrade works and the task is lost.
 *
 * So every route to the plans goes through here, and here is the only place
 * that decides what "where they came from" means.
 *
 * ⚠️ IT REUSES ReturnUrlService, which already runs every candidate through
 * `safeInternalPath` — one leading slash, no scheme, no host. That is the
 * guard funnel-e2e forces with a hostile returnUrl, and a second
 * implementation would be a second place for an open redirect to appear.
 *
 * @example
 *   // a quota refusal
 *   this.upgrade.showPlans();
 *
 *   // a feature the plan does not include, from a menu
 *   this.upgrade.showPlans('/teachers/search');
 */
@Injectable({ providedIn: 'root' })
export class UpgradeService {
  private readonly router = inject(Router);
  private readonly returnUrl = inject(ReturnUrlService);

  /**
   * Capture where we are and go to the plans.
   *
   * @param from Where to come back to. Defaults to the current URL, which is
   *   what a quota refusal wants — the page the action was refused on.
   */
  showPlans(from?: string): void {
    /*
      ⚠️ CAPTURED BEFORE NAVIGATING, obviously — but worth saying, because the
      obvious alternative (capture inside the billing page from the router's
      previous URL) does not survive a full page load, and a school that
      refreshes mid-upgrade is not a rare case on a slow connection.
    */
    this.returnUrl.capture(from ?? this.router.url);

    void this.router.navigate(['/billing']);
  }

  /**
   * Whether there is somewhere to go back to.
   *
   * ⚠️ `peek`, so asking does not spend it.
   */
  hasOrigin(): boolean {
    return this.returnUrl.peek() !== null;
  }
}
