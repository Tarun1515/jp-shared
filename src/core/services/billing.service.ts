import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { JP_API_CONFIG } from '../app-identity';
import { ApiResponse } from '../models/api-response.model';

/** One feature a plan includes, and how much of it. */
export interface PlanIncludes {
  featureId: number;
  featureCode: string;
  featureName: string;
  isIncluded: boolean;

  /**
   * 🔴 `null` = unlimited within the plan. NOT zero.
   *
   * The engine uses the identical convention (`@QuotaPerPeriod`), and a screen
   * that renders null as "0" tells a customer they have nothing when they have
   * everything.
   */
  quotaPerPeriod: number | null;
}

/** One plan this kind of account could be on. */
export interface Plan {
  planId: number;
  planCode: string;
  name: string;
  userTypeId: number;

  /** `null` = perpetual, which is every free plan. */
  durationDays: number | null;
  price: number;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
  features: PlanIncludes[];
}

/** Used against allowed, for one feature, this period. */
export interface FeatureUsage {
  featureId: number;
  featureCode: string;
  featureName: string;
  used: number;

  /** `null` = unlimited within the plan. */
  allowed: number | null;

  /** 🔴 Clamped at zero by the server, never negative (6.5-D). */
  remaining: number | null;
}

/** What the account is on, and what it has used of it. */
export interface CurrentPlan {
  subscriptionId: number;
  planId: number;
  planCode: string;
  planName: string;
  price: number;
  durationDays: number | null;
  startsOn: string;
  endsOn: string | null;
  statusId: number;

  /** The row's own flag. */
  isActive: boolean;

  /**
   * 🔴 NOT the same as `isActive`.
   *
   * A paid subscription past `endsOn` is still an ACTIVE row and is no longer
   * in force — it reads as the free baseline instead (6.5-C). The server
   * computes this from `fn_SubscriptionInForce`, the one predicate every money
   * question in the product routes through.
   */
  inForce: boolean;

  /**
   * True when the numbers above describe the FREE baseline because a paid plan
   * has lapsed, rather than what the account bought.
   */
  onFreeBaseline: boolean;

  usage: FeatureUsage[];
}

/** What a requester is told after asking to change plan. */
export interface PlanChangeRequested {
  requestId: number;

  /** The reference a school quotes to support (2.46). */
  requestNo: string;
  paymentId: number;
  paymentUid: string;
  priceQuoted: number;
}

/** One subscription the account has held, past or present. */
export interface SubscriptionHistoryRow {
  subscriptionId: number;
  planId: number;
  planName: string;
  startsOn: string;
  endsOn: string | null;
  statusId: number;
  isActive: boolean;

  /** From `fn_SubscriptionInForce` — never re-derived on the client. */
  inForce: boolean;

  /** `null` on every row provisioning opened — nobody paid for those. */
  sourcePaymentUid: string | null;
}

/**
 * Billing, from the account's own side. Shared by both portals.
 *
 * ----------------------------------------------------------------------------
 * 🔴 ONE SERVICE FOR SCHOOL AND TEACHER, FOR THE SAME REASON AS NOTIFICATIONS
 * ----------------------------------------------------------------------------
 * Every route here reads the owner from the caller's token — the organisation
 * for a school, the user for a teacher (2.39, 2.51) — so there is no method
 * that takes an owner, because no route accepts one. That makes the two
 * portals' needs identical, and G27's lesson is that a second copy is where
 * two identical things start to disagree.
 *
 * ----------------------------------------------------------------------------
 * 🔒 WHAT THIS BUYS, AND WHAT IT NEVER BUYS (2.56, LOCKED)
 * ----------------------------------------------------------------------------
 * A plan buys CAPABILITY — whether a school may search at all, how many
 * invitations it may send. It never buys a teacher's contact details. Nothing
 * here reads or renders a contact field, and there is no shape in this file
 * that could carry one.
 *
 * ----------------------------------------------------------------------------
 * ⚠️ THERE IS NO PAY-NOW METHOD, AND ITS ABSENCE IS THE DESIGN
 * ----------------------------------------------------------------------------
 * 6.5 is manual-first: the account asks, money arrives by NEFT, cheque or
 * cash, and an administrator confirms it. A gateway call stubbed out here
 * would be a button that looks like it works — the mockup-era failure this
 * project exists to avoid (2.62).
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(JP_API_CONFIG);

  private readonly plansSignal = signal<Plan[]>([]);
  private readonly currentSignal = signal<CurrentPlan | null>(null);
  private readonly historySignal = signal<SubscriptionHistoryRow[]>([]);
  private readonly loadingSignal = signal(false);

  /**
   * 🔴 A FAILED READ IS NOT AN EMPTY ACCOUNT.
   *
   * "You are on no plan" and "we could not ask" are different statements, and
   * showing the first when the second is true is how somebody concludes their
   * payment was lost. The notification page records the same distinction.
   */
  private readonly failedSignal = signal(false);

  readonly plans = this.plansSignal.asReadonly();
  readonly current = this.currentSignal.asReadonly();
  readonly history = this.historySignal.asReadonly();
  readonly isLoading = this.loadingSignal.asReadonly();
  readonly hasFailed = this.failedSignal.asReadonly();

  /**
   * The plans this account could move TO — the catalog minus the one it is on.
   *
   * ⚠️ Computed, because "what can I change to" is the question the screen
   * actually asks, and answering it in the template would put the rule in
   * three places if a second screen ever needs it.
   */
  readonly changeableTo = computed(() => {
    const current = this.currentSignal();

    return this.plansSignal().filter((p) => p.planId !== current?.planId);
  });

  /**
   * ⚠️ True when the catalog holds nothing to move to.
   *
   * On the day 6.5 ships this is TRUE for everybody: only the free plan is
   * seeded, because pricing is not finalised and a price we ship gets quoted
   * back (008_seed_plans.sql). The screen says so plainly instead of offering
   * an empty chooser.
   */
  readonly nothingToChangeTo = computed(() => this.changeableTo().length === 0);

  load(): void {
    this.loadingSignal.set(true);
    this.failedSignal.set(false);

    this.http
      .get<ApiResponse<Plan[]>>(`${this.api.appApiUrl}/billing/plans`)
      .pipe(
        map((r) => r.data ?? []),
        catchError(() => {
          this.failedSignal.set(true);
          return of([] as Plan[]);
        }),
      )
      .subscribe((plans) => this.plansSignal.set(plans));

    this.http
      .get<ApiResponse<CurrentPlan | null>>(`${this.api.appApiUrl}/billing/my-plan`)
      .pipe(
        map((r) => r.data ?? null),
        catchError(() => {
          this.failedSignal.set(true);
          return of(null);
        }),
      )
      .subscribe((current) => {
        this.currentSignal.set(current);
        this.loadingSignal.set(false);
      });

    this.http
      .get<ApiResponse<SubscriptionHistoryRow[]>>(`${this.api.appApiUrl}/billing/my-history`)
      .pipe(
        map((r) => r.data ?? []),
        catchError(() => of([] as SubscriptionHistoryRow[])),
      )
      .subscribe((rows) => this.historySignal.set(rows));
  }

  /**
   * Asks to move to a plan. Grants nothing.
   *
   * 🔴 The caller gets the envelope rather than a boolean, because the
   * RequestNo in it is the thing the account quotes to support (2.46) and the
   * screen shows it.
   */
  requestChange(planId: number, paymentModeId: number): Observable<PlanChangeRequested | null> {
    return this.http
      .post<ApiResponse<PlanChangeRequested>>(`${this.api.appApiUrl}/billing/plan-change`, {
        planId,
        paymentModeId,
      })
      .pipe(
        map((r) => r.data ?? null),

        // Reload, so the panel and the history reflect the pending request.
        tap(() => this.load()),
      );
  }
}
