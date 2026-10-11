import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Notification, NotificationService } from '../../core/services/notification.service';

/**
 * The bell and its panel. One component, both portals.
 *
 * ----------------------------------------------------------------------------
 * 🔴 WHY THIS IS IN jp-shared AND NOT IN EACH APP
 * ----------------------------------------------------------------------------
 * G27 is the whole argument. `.tabs` and `.banner` were hand-rolled in three
 * components each, and the fourth screen was always going to write a fourth
 * copy. A notification centre is needed by jp-school AND jp-teacher on day one,
 * so writing it twice would start that story again — with the added problem
 * that the two copies would drift in what they say about unread state.
 *
 * ----------------------------------------------------------------------------
 * 🔒 IT SHOWS ONLY WHAT THE SIGNED-IN PERSON OWNS
 * ----------------------------------------------------------------------------
 * There is nothing to get wrong here, and that is deliberate: the service has
 * no method that takes a user, because no route accepts one. The component
 * cannot ask the wrong question.
 *
 * ----------------------------------------------------------------------------
 * ⚠️ WHAT THE ICON MEANS, AND WHAT IT DOES NOT
 * ----------------------------------------------------------------------------
 * The emoji per type is decoration, chosen from `typeCode` — the stable master
 * code (2.21), never the display text. An unknown code gets a neutral dot
 * rather than nothing: a new notification type added on the server must still
 * render on an app that has not been rebuilt, which is the normal state of
 * affairs with federation.
 */
@Component({
  selector: 'ui-notification-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-notification-bell.component.html',
  styleUrl: './ui-notification-bell.component.scss',
})
export class UiNotificationBellComponent {
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly open = signal(false);

  protected readonly unreadCount = this.notifications.unreadCount;
  protected readonly items = this.notifications.notifications;
  protected readonly loading = this.notifications.isLoading;
  protected readonly failed = this.notifications.hasFailed;
  protected readonly hasUnread = this.notifications.hasUnread;

  /**
   * ⚠️ Capped in the LABEL, not in the request. The server is asked for a page
   * of twenty; "9+" is what a badge wider than two characters does to a header.
   */
  protected readonly badgeLabel = computed(() => {
    const n = this.unreadCount();

    return n > 9 ? '9+' : String(n);
  });

  protected toggle(): void {
    const next = !this.open();
    this.open.set(next);

    /*
      ⚠️ Loaded on OPEN, every time, rather than cached. Somebody opening the
      panel is asking "what is new" — serving them the list from when they last
      looked would answer a question they did not ask. It is one request on a
      deliberate click.
    */
    if (next) {
      this.notifications.load();
    }
  }

  protected close(): void {
    this.open.set(false);
  }

  /**
   * Escape closes it.
   *
   * 🔴 The panel is a popover over the whole page, and a popover with no
   * keyboard dismissal is a trap — the same lesson the shell's navigation scrim
   * records in its own comment.
   */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) {
      this.close();
    }
  }

  protected markAllRead(): void {
    this.notifications.markAllRead();
  }

  /**
   * Opening one marks it read and follows it.
   *
   * ⚠️ Marked read even when there is nowhere to go. "Read" describes the
   * person having seen it, which they have — tying it to navigation would leave
   * notifications about deleted things permanently unread.
   */
  protected activate(row: Notification): void {
    this.notifications.markRead(row.notificationId);

    if (row.actionUrl) {
      this.close();
      void this.router.navigateByUrl(row.actionUrl);
    }
  }

  /** Decoration, from the stable code. Unknown codes get a neutral mark. */
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
   * "4 minutes ago", and in IST terms for anything older than a day.
   *
   * ⚠️ Storage is UTC and business rules are IST (2.28). `createdOn` arrives as
   * UTC, so the relative arithmetic is done on the instant and only the
   * fallback formats a date — where the locale does the conversion.
   */
  protected when(createdOn: string): string {
    const then = new Date(createdOn.endsWith('Z') ? createdOn : `${createdOn}Z`).getTime();
    const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;

    return new Date(then).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
    });
  }
}
