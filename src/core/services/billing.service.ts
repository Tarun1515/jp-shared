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

/**
 * 🔴 SR-4. An open plan change: asked for, not paid for, nothing granted.
 *
 * ----------------------------------------------------------------------------
 * 🔴 WHY THIS SHAPE HAD TO BECOME READABLE
 * ----------------------------------------------------------------------------
 * 6.5B only ever learned about a pending request from the POST that created
 * it, so a reload made the account go quiet about money it had promised. That
 * was survivable while the only way to get one was to press the button
 * yourself.
 *
 * SR-4 lets REGISTRATION create one: a school picks a paid plan on the form,
 * is approved days later, and the first time it ever sees the request is a
 * login on another device with no response to remember. So the state is read
 * from the server, not kept in a signal that a refresh empties.
 *
 * ----------------------------------------------------------------------------
 * 🔴 WHAT IS DELIBERATELY ABSENT
 * ----------------------------------------------------------------------------
 * Any allowance, quota or usage field. A pending request grants nothing, and a
 * shape that carried capability beside an unpaid intention is how a screen
 * starts implying a school bought something it has not. What the account can
 * actually do is `CurrentPlan`, and on this path that is the free plan.
 */
export interface OpenPlanChange {
  requestId: number;

  /** The reference to quote when ringing about the money (2.46). */
  requestNo: string;
  submittedOn: string;
  paymentId: number;
  paymentUid: string;
  planId: number;
  planCode: string;

  /**
   * 🔴 The name AS THE CATALOGUE HOLDS IT.
   *
   * While the figures are placeholders every paid plan is named
   * "Standard (SAMPLE PRICING)" — the marker is in the NAME because a customer
   * reads the name and nobody reads a seed file's comment, and a build guard
   * fails if it disappears while the prices are still dummy. Tidying it on a
   * screen would defeat that guard from outside the database.
   */
  planName: string;

  durationDays: number | null;

  /** 🔴 What was AGREED, not what the catalogue says today (2.7). */
  priceQuoted: number | null;

  /** What is recorded — the expected figure, until an admin replaces it. */
  amount: number;
  paymentModeId: number;
  paymentModeName: string;
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
   * 🔴 SR-4. The account's open plan change, read from the server.
   *
   * ⚠️ `null` is the ordinary state and renders as nothing at all. It must not
   * render as a failure: most accounts owe nothing most of the time.
   */
  private readonly openRequestSignal = signal<OpenPlanChange | null>(null);

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

  /** 🔴 SR-4. Asked for, not paid for. See {@link OpenPlanChange}. */
  readonly openRequest = this.openRequestSignal.asReadonly();

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
   * On the day 6.5 shipped this was TRUE for everybody: only the free plan was
   * seeded, because pricing was not finalised and a price we ship gets quoted
   * back (008_seed_plans.sql). SR-4 seeded two paid tiers on the client's
   * instruction, with PLACEHOLDER figures that say so in the plan NAME — so
   * this is now false for a school and still true for a teacher, and the
   * screen says the honest thing in both cases rather than offering an empty
   * chooser.
   */
  readonly nothingToChangeTo = computed(() => this.changeableTo().length === 0);

  load(): void {
    this.loadingSignal.set(true);
    this.failedSignal.set(false);

    this.loadPlans();
    this.loadOpenRequest();

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
   * 🔴 SR-4. The catalog ALONE, for a caller that has no account yet.
   *
   * ----------------------------------------------------------------------------
   * 🔴 WHY THIS IS SEPARATE FROM load()
   * ----------------------------------------------------------------------------
   * The registration form needs the plans, and the school filling it in has no
   * organisation, no subscription and no history — it is applying to exist.
   * Calling `load()` there would fire `/billing/my-plan` and
   * `/billing/my-history` for an account that legitimately has neither, set
   * `hasFailed`, and paint "your plan could not be loaded" across a form about
   * something else entirely.
   *
   * ⚠️ `load()` CALLS THIS rather than repeating the request, so there is one
   * place that knows the catalog's URL and its failure rule.
   */
  loadPlans(): void {
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
  }

  /**
   * 🔴 SR-4. "Do I owe money, and what for?" — read, never remembered.
   *
   * ----------------------------------------------------------------------------
   * ⚠️ A FAILURE HERE DOES NOT SET hasFailed
   * ----------------------------------------------------------------------------
   * `hasFailed` makes the whole billing screen say "your plan could not be
   * loaded", and a pending request is an EXTRA that most accounts do not have.
   * Taking the screen down because this one read failed would hide the plan
   * panel, which is the thing the person actually came for.
   *
   * ⚠️ So a failure leaves the signal null — "nothing pending" — which is the
   * same thing it says for the overwhelming majority of accounts. That is the
   * right trade in ONE direction only: a request that exists and is not shown
   * costs the school a conversation with support, while a request SHOWN that
   * does not exist would be a demand for money nobody owes.
   */
  loadOpenRequest(): void {
    this.http
      .get<ApiResponse<OpenPlanChange | null>>(
        `${this.api.appApiUrl}/billing/my-pending-change`,
      )
      .pipe(
        map((r) => r.data ?? null),
        catchError(() => of(null)),
      )
      .subscribe((pending) => this.openRequestSignal.set(pending));
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
