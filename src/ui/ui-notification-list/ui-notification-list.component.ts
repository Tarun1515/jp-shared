import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Notification, NotificationService } from '../../core/services/notification.service';

/**
 * The full notification page. One component, routed by both portals.
 *
 * ----------------------------------------------------------------------------
 * 🔴 WHY THIS IS SHARED AND ROUTED DIRECTLY
 * ----------------------------------------------------------------------------
 * The bell's panel shows the last twenty; this is the page the seeded
 * SCHOOL_NOTIFICATIONS and TEACHER_NOTIFICATIONS rows point at, where somebody
 * reads back through them. Both portals need exactly the same screen, so both
 * route straight at this component rather than wrapping it — G27's lesson is
 * that a second copy is where the two start to disagree.
 *
 * ⚠️ It is routed, not a page-within-a-page: the app shell supplies the chrome,
 * and this supplies the content. Nothing here knows which portal it is in,
 * because nothing here needs to.
 *
 * ----------------------------------------------------------------------------
 * 🔒 THE SAME SCOPE AS THE BELL, FOR THE SAME REASON
 * ----------------------------------------------------------------------------
 * It reads the identical service, which has no method that takes a user because
 * no route accepts one, and `t_app_notifications` has no SchoolId or
 * OrganizationUid at all (030). There is nothing here to get wrong.
 */
@Component({
  selector: 'ui-notification-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-notification-list.component.html',
  styleUrl: './ui-notification-list.component.scss',
})
export class UiNotificationListComponent {
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly items = this.notifications.notifications;
  protected readonly loading = this.notifications.isLoading;
  protected readonly failed = this.notifications.hasFailed;
  protected readonly hasUnread = this.notifications.hasUnread;

  protected readonly pageNumber = signal(1);
  protected readonly pageSize = 50;

  /**
   * ⚠️ Fifty rather than the bell's twenty. This is the screen somebody opens
   * to read back through a week, and a pager that moves every twenty rows for
   * that is friction. Still the SERVER's page, not a client-side slice (G29).
   */
  protected readonly showPager = computed(() => this.items().length === this.pageSize
    || this.pageNumber() > 1);

  constructor() {
    this.notifications.load(1, this.pageSize);
  }

  protected page(delta: number): void {
    const next = this.pageNumber() + delta;
    if (next < 1) return;

    this.pageNumber.set(next);
    this.notifications.load(next, this.pageSize);
  }

  protected markAllRead(): void {
    this.notifications.markAllRead();
  }

  protected activate(row: Notification): void {
    this.notifications.markRead(row.notificationId);

    if (row.actionUrl) {
      void this.router.navigateByUrl(row.actionUrl);
    }
  }

  /** Decoration, from the stable code (2.21). Unknown codes get a neutral mark. */
  protected icon(typeCode: string): string {
    switch (typeCode) {
      case 'APPLICATION_RECEIVED': return '📨';
      case 'APPLICATION_VIEWED': return '👀';
      case 'APPLICATION_SHORTLIST': return '⭐';
      case 'APPLICATION_REJECTED': return '—';
      case 'OFFER_SENT': return '📄';
      case 'OFFER_ACCEPTED': return '✅';
      case 'OFFER_DECLINED': return '↩️';
      case 'OFFER_WITHDRAWN': return '🚫';
      case 'HIRED': return '🎉';
      case 'INVITE_RECEIVED': return '✉️';
      case 'INVITE_ACCEPTED': return '🤝';
      case 'INVITE_IGNORED': return '→';
      case 'VERIFICATION_APPROVED': return '🛡️';
      case 'VERIFICATION_REJECTED': return '!';
      default: return '•';
    }
  }

  /**
   * The day, in IST.
   *
   * ⚠️ Storage is UTC and business rules are IST (2.28). `createdOn` arrives as
   * UTC, so the zone is named rather than left to the browser's — a school in
   * Mumbai and a reader abroad must see the same date on the same row.
   */
  protected day(createdOn: string): string {
    const at = new Date(createdOn.endsWith('Z') ? createdOn : `${createdOn}Z`);

    return at.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
    });
  }

  protected time(createdOn: string): string {
    const at = new Date(createdOn.endsWith('Z') ? createdOn : `${createdOn}Z`);

    return at.toLocaleTimeString('en-IN', {
      hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
    });
  }
}
