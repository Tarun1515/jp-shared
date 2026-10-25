import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  BillingService,
  CurrentPlan,
  FeatureUsage,
  Plan,
  SubscriptionHistoryRow,
} from '../../core/services/billing.service';
import { Router } from '@angular/router';
import { ReturnUrlService } from '../../core/services/return-url.service';
import { AuthService } from '../../core/services/auth.service';
import { UiBadgeComponent } from '../ui-badge/ui-badge.component';

/**
 * The account's own billing screen. Phase 6.5B.
 *
 * ----------------------------------------------------------------------------
 * 🔴 ONE COMPONENT, ROUTED BY BOTH PORTALS
 * ----------------------------------------------------------------------------
 * A school and a teacher ask the same four questions — what am I on, what have
 * I used, what else is there, how do I move — and every route behind them
 * reads the owner from the caller's token (2.39, 2.51). There is nothing
 * portal-specific to wrap, and G27's lesson is that the second copy is where
 * two identical screens start to disagree. `/notifications` took the same
 * shape in 6C-2 for the same reason.
 *
 * ----------------------------------------------------------------------------
 * 🔴 THERE IS NO PAY-NOW BUTTON
 * ----------------------------------------------------------------------------
 * 6.5 is manual-first. The flow ends at "we have recorded your request — pay
 * by NEFT, cheque or cash and an administrator will confirm it", because that
 * is what actually happens. A disabled "Pay online" button would be 2.62's
 * "not yet" applied to something nobody has promised a date for, and a working
 * -looking one would be a mockup.
 *
 * ----------------------------------------------------------------------------
 * 🔒 NOTHING HERE RENDERS A CONTACT DETAIL (2.56, LOCKED)
 * ----------------------------------------------------------------------------
 * A plan buys capability, never a teacher's phone number or email. No shape
 * this screen reads could carry one.
 */
@Component({
  selector: 'ui-billing-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  /*
    ⚠️ No confirm dialog. The shell already hosts one, and it takes a yes/no
    — this confirmation carries a payment-mode CHOICE, so it is an inline
    step instead. Building a second modal would have meant a second copy of
    the .dialog styles, which are scoped to that component: G27 exactly.
  */
  imports: [UiBadgeComponent],
  templateUrl: './ui-billing-page.component.html',
  styleUrl: './ui-billing-page.component.scss',
})
export class UiBillingPageComponent {
  private readonly billing = inject(BillingService);
  private readonly auth = inject(AuthService);

  /*
    🔴 SR-4: WHERE THEY CAME FROM, SO THEY CAN BE PUT BACK.

    A school hits a quota wall mid-task — posting their second job, inviting
    their twenty-sixth teacher — clicks "see plans", and lands here. Sending
    them to the dashboard afterwards means they have to find their way back to
    a half-finished job, and most will not: the upgrade worked and the task
    they were doing is lost.

    ⚠️ ReturnUrlService IS REUSED, NOT REBUILT. It already runs every candidate
    through safeInternalPath — one leading slash, no scheme, no host — which is
    the guard funnel-e2e section 2 forces with a hostile returnUrl. A second
    implementation here is a second place for an open redirect to appear.
  */
  private readonly returnUrl = inject(ReturnUrlService);
  private readonly router = inject(Router);

  /** Where "back to what I was doing" goes, when there is such a place. */
  /*
    ⚠️ READ ONCE AT CONSTRUCTION, WITH peek() — NOT IN AN effect().

    The first version used an effect, which threw NG0600 (writing to a signal
    inside an effect is refused by default) and blanked the whole billing
    page — the suite saw it as .bill__current never appearing.

    An effect was wrong anyway: peek() is a plain read of session storage,
    not a signal, so there was nothing reactive to track and the effect would
    have run exactly once regardless.

    🔴 peek, NOT consume. The return is only spent when they act on it — a
    school that opens the plans, reads them and wanders off must not have its
    destination silently cleared.
  */
  protected readonly cameFrom = signal<string | null>(this.returnUrl.peek());

  /**
   * 🔒 BILLING.MANAGE — whether this person may commit the account to a
   * payment. SCHOOL_OWNER and TEACHER hold it; an HR, a Senior HR and a
   * read-only viewer do not (jp_sso 007).
   *
   * ⚠️ PRESENTATION ONLY. The server checks the same permission and answers
   * 403, and the verification forces that negative — this exists so a person
   * who cannot do the thing is not shown a control that fails, which is 2.62's
   * "not allowed": remove the control and explain, rather than disable it.
   *
   * 🔴 The PANEL above it stays visible to everybody on purpose. An HR about to
   * post a job needs to know what this month's allowance is; hiding it would
   * mean they discover the limit by being refused by it.
   */
  protected readonly canRequest = computed(() =>
    this.auth.hasPermission('BILLING.MANAGE'));

  protected readonly current = this.billing.current;
  protected readonly plans = this.billing.plans;
  protected readonly history = this.billing.history;
  protected readonly loading = this.billing.isLoading;
  protected readonly failed = this.billing.hasFailed;
  protected readonly changeableTo = this.billing.changeableTo;
  protected readonly nothingToChangeTo = this.billing.nothingToChangeTo;

  /** The plan a confirmation dialog is open for, or null. */
  protected readonly choosing = signal<Plan | null>(null);

  /** Set once a request has been recorded, so the screen can say what next. */
  protected readonly requested = signal<{ requestNo: string; planName: string } | null>(null);

  protected readonly submitting = signal(false);

  /**
   * 🔴 The payment modes a person can actually use.
   *
   * ⚠️ ONLINE (1) is deliberately absent: there is no gateway, so offering it
   * would be a promise the product cannot keep. The ids match
   * m_mdm_payment_modes, which is a master — if a fifth mode is ever added
   * there, this list is the one place that needs it (2.7's spirit, though the
   * list is short enough that fetching a master for three rows would be worse
   * than the hardcoding it avoids).
   */
  protected readonly modes = [
    { id: 2, label: 'Bank transfer (NEFT / IMPS / RTGS)' },
    { id: 3, label: 'Cheque' },
    { id: 4, label: 'Cash' },
  ];

  protected readonly chosenMode = signal(2);

  /**
   * 🔴 Why the panel might be describing a plan the account is not paying for.
   *
   * A lapsed paid subscription reads as the free baseline (6.5-C), and a screen
   * that shows the free plan's numbers under the paid plan's name would be the
   * specific lie this phase was designed to avoid. So the state is named.
   */
  protected readonly lapsed = computed(() => {
    const c = this.current();

    return c !== null && !c.inForce && c.onFreeBaseline;
  });

  /** Cancelled or deactivated — a decision somebody made, not time passing. */
  protected readonly stopped = computed(() => {
    const c = this.current();

    return c !== null && !c.inForce && !c.onFreeBaseline;
  });

  constructor() {
    this.billing.load();
  }

  protected choose(plan: Plan): void {
    this.choosing.set(plan);
  }

  /**
   * Back to the page they were on when they hit the wall.
   */
  protected goBack(): void {
    const target = this.returnUrl.consume();

    void this.router.navigateByUrl(target ?? '/dashboard');
  }

  protected cancelChoice(): void {
    this.choosing.set(null);
  }

  protected confirm(): void {
    const plan = this.choosing();
    if (!plan || this.submitting()) return;

    this.submitting.set(true);

    this.billing.requestChange(plan.planId, this.chosenMode()).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.choosing.set(null);

        if (result) {
          this.requested.set({ requestNo: result.requestNo, planName: plan.name });

          /*
            🔴 THE RETURN IS OFFERED, NOT TAKEN. Navigating away the instant
            the request lands would snatch the request number off the screen —
            and that number is the thing they need when they ring up about a
            payment nobody has confirmed yet.

            So the confirmation stays, and it carries the way back. cameFrom is
            refreshed here because consume() has not run: the button is what
            spends it.
          */
          this.cameFrom.set(this.returnUrl.peek());
        }
      },
      error: () => {
        this.submitting.set(false);
        this.choosing.set(null);

        /*
          ⚠️ The interceptor already shows the server's message, which carries
          the real reason — ALREADY_REQUESTED, or a plan that is not for this
          user type. Adding a second toast here would say it twice, and the
          generic one would be the less useful of the two.
        */
      },
    });
  }

  protected setMode(value: string): void {
    this.chosenMode.set(Number(value));
  }

  /**
   * ⚠️ "Unlimited", not "0", when the quota is null — the engine's convention
   * and the one a screen is most likely to get backwards.
   */
  protected allowance(usage: FeatureUsage): string {
    return usage.allowed === null ? 'Unlimited' : String(usage.allowed);
  }

  protected remainingLabel(usage: FeatureUsage): string {
    if (usage.allowed === null) return 'No limit';

    return `${usage.remaining} left`;
  }

  /** 🔴 Over-used happens on a downgrade, and the bar must not overflow. */
  protected usedPercent(usage: FeatureUsage): number {
    if (usage.allowed === null || usage.allowed === 0) return 0;

    return Math.min(100, Math.round((usage.used / usage.allowed) * 100));
  }

  protected overspent(usage: FeatureUsage): boolean {
    return usage.allowed !== null && usage.used > usage.allowed;
  }

  protected quota(plan: Plan, featureCode: string): string {
    const f = plan.features.find((x) => x.featureCode === featureCode);

    if (!f || !f.isIncluded) return 'Not included';

    return f.quotaPerPeriod === null ? 'Unlimited' : `${f.quotaPerPeriod} per month`;
  }

  protected priceLabel(plan: Plan | CurrentPlan): string {
    const price = 'price' in plan ? plan.price : 0;

    if (price === 0) return 'Free';

    const days = 'durationDays' in plan ? plan.durationDays : null;

    return days === null
      ? `₹${price.toLocaleString('en-IN')}`
      : `₹${price.toLocaleString('en-IN')} for ${days} days`;
  }

  /**
   * The day, in IST.
   *
   * ⚠️ Storage is UTC and the rules are IST (2.28). The zone is named rather
   * than left to the browser's, so a school in Mumbai and somebody reviewing
   * from abroad read the same date off the same row.
   */
  protected day(value: string | null): string {
    if (!value) return '—';

    const at = new Date(value.endsWith('Z') ? value : `${value}Z`);

    return at.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
    });
  }

  /** Decoration from the stable code (2.21), never from the name. */
  protected statusTone(row: SubscriptionHistoryRow): 'success' | 'neutral' | 'danger' {
    if (row.inForce) return 'success';

    return row.statusId === 3 ? 'danger' : 'neutral';
  }

  protected statusLabel(row: SubscriptionHistoryRow): string {
    if (row.inForce) return 'Current';

    switch (row.statusId) {
      case 2: return 'Ended';
      case 3: return 'Cancelled';
      default: return 'Not active';
    }
  }
}
