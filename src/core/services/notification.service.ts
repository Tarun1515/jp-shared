import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, interval, map, of, switchMap, tap } from 'rxjs';
import { JP_API_CONFIG } from '../app-identity';
import { ApiResponse } from '../models/api-response.model';
import { AuthService } from './auth.service';

/** One notification, exactly as `GET /api/notifications` returns it. */
export interface Notification {
  notificationId: number;
  notificationUid: string;

  /**
   * The master's stable code — branch on this, never on the text.
   *
   * 2.21: a client that branches on a message is a client that breaks when
   * somebody fixes a typo.
   */
  typeCode: string;
  typeName: string;
  title: string;
  body: string | null;

  /**
   * A path inside THIS app, or null.
   *
   * ⚠️ Relative by contract (030). The server stores `/applicants/12`, never a
   * host — G30's lesson was a button that did nothing, and an absolute URL
   * baked into a stored row is the slower version of the same bug.
   */
  actionUrl: string | null;

  /** 1 application · 2 invitation · 3 offer · 4 job. */
  refEntityTypeId: number | null;
  refEntityUid: string | null;
  isRead: boolean;
  readOn: string | null;
  createdOn: string;
}

/**
 * The notification centre's state, shared by every portal.
 *
 * ----------------------------------------------------------------------------
 * 🔒 THERE IS NO WAY TO ASK FOR SOMEBODY ELSE'S
 * ----------------------------------------------------------------------------
 * Every method here calls a route that reads the caller's uid from their token
 * and nothing else. No method takes a user id, because no route accepts one —
 * and `t_app_notifications` has no SchoolId or OrganizationUid at all, so a
 * cross-user query is not expressible even in SQL (030).
 *
 * ----------------------------------------------------------------------------
 * 🔴 WHY THE BELL POLLS, AND WHY SLOWLY
 * ----------------------------------------------------------------------------
 * There is no websocket in this product and adding one for a badge would be a
 * large piece of infrastructure for a number. So the unread count is polled.
 *
 * ⚠️ Sixty seconds, not five. A notification is not a chat message: the events
 * behind these are an application, an offer, an invitation — things that happen
 * a few times a day and are read minutes or hours later. A five-second poll
 * would mean 720 requests an hour per open tab for a number that changes twice.
 *
 * The poll is also the ONLY thing that runs on a timer. The list is fetched
 * when somebody opens the panel, because that is when they want to read it.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(JP_API_CONFIG);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly unread = signal(0);
  private readonly items = signal<Notification[]>([]);
  private readonly loading = signal(false);
  private readonly failed = signal(false);

  /** What the bell shows. Zero renders no badge at all, not a "0". */
  readonly unreadCount = this.unread.asReadonly();

  readonly notifications = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly hasFailed = this.failed.asReadonly();

  readonly hasUnread = computed(() => this.unread() > 0);

  constructor() {
    /*
      ⚠️ THE POLL IS GATED ON BEING SIGNED IN, and that is not a nicety. Polling
      while signed out means a 401 every minute, which the auth interceptor
      would treat as a session to refresh — a signed-out tab quietly trying to
      resurrect itself forever.
    */
    interval(60_000)
      .pipe(
        switchMap(() => (this.auth.isAuthenticated() ? this.fetchUnread() : of(0))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** Called by the shell once the session is known, so the bell is not blank. */
  start(): void {
    if (this.auth.isAuthenticated()) {
      this.fetchUnread().subscribe();
    }
  }

  private fetchUnread(): Observable<number> {
    return this.http
      .get<ApiResponse<{ unreadCount: number }>>(`${this.api.appApiUrl}/notifications/unread-count`)
      .pipe(
        map((r) => r.data?.unreadCount ?? 0),
        tap((n) => this.unread.set(n)),
        /*
          ⚠️ Swallowed, and only here. A failed badge poll must not raise a toast
          every sixty seconds — the user cannot act on it and would learn to
          dismiss the toast that matters. The count simply stays where it was.
        */
        catchError(() => of(this.unread())),
      );
  }

  /** The list, newest first. Server-side paged from day one (G29). */
  load(pageNumber = 1, pageSize = 20): void {
    this.loading.set(true);
    this.failed.set(false);

    this.http
      .get<ApiResponse<Notification[]>>(
        `${this.api.appApiUrl}/notifications?pageNumber=${pageNumber}&pageSize=${pageSize}`,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.items.set(r.data ?? []);
          this.loading.set(false);
        },
        error: () => {
          /*
            🔴 A FAILED LOAD IS SAID OUT LOUD, unlike the badge poll. Somebody
            has opened the panel and is waiting; an empty list would read as
            "you have nothing", which is a different and wrong statement.
          */
          this.items.set([]);
          this.loading.set(false);
          this.failed.set(true);
        },
      });
  }

  /**
   * Marks one read.
   *
   * ⚠️ The signal is updated optimistically and NOT rolled back on failure, by
   * design: the row is already on screen, the person has seen it, and un-reading
   * it under their cursor would be the more confusing outcome. The next poll
   * corrects the count either way.
   */
  markRead(notificationId: number): void {
    const row = this.items().find((n) => n.notificationId === notificationId);
    if (!row || row.isRead) {
      return;
    }

    this.items.update((list) =>
      list.map((n) => (n.notificationId === notificationId ? { ...n, isRead: true } : n)));
    this.unread.update((n) => Math.max(0, n - 1));

    this.http
      .post<ApiResponse<unknown>>(`${this.api.appApiUrl}/notifications/${notificationId}/read`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => this.fetchUnread().subscribe() });
  }

  /** Marks everything read. Zero affected is a success — there was nothing to do. */
  markAllRead(): void {
    if (!this.hasUnread()) {
      return;
    }

    this.items.update((list) => list.map((n) => ({ ...n, isRead: true })));
    this.unread.set(0);

    this.http
      .post<ApiResponse<unknown>>(`${this.api.appApiUrl}/notifications/read-all`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => this.fetchUnread().subscribe() });
  }

  /** Dropped on sign-out, so the next person's bell does not inherit a count. */
  clear(): void {
    this.unread.set(0);
    this.items.set([]);
    this.failed.set(false);
  }
}
