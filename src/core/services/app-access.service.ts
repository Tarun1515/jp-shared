import { Injectable, computed, inject, signal } from '@angular/core';
import { APP_LABELS, JP_APP_IDENTITY, JpAppKey, appKeyForUserType } from '../app-identity';
import { AuthService } from './auth.service';

/** What to tell someone who signed in successfully at the wrong app. */
export interface WrongAppNotice {
  /** e.g. "That is a school account." */
  message: string;
  /** e.g. "Sign in at school.staffroom.in" */
  actionLabel: string;
  /** Absolute URL of the app they actually belong to. */
  url: string;
}

/*==============================================================================
  THE CROSS-APP LOGIN GUARD

  All three apps authenticate against the SAME SSO API, so a school owner CAN
  sign in on the teacher app. The credentials are right, the token is genuine,
  the API is happy. The app is simply the wrong one.

  Left unhandled, what they get is a valid session, an empty sidebar (because
  USP_GetUserMenus filters by UserTypeId and returns them nothing for this app)
  and a blank page. Every one of those people concludes the product is broken,
  and they are not wrong to — nothing on screen says otherwise.

  So: the token's utype claim is checked against the app's own identity, in two
  places, because there are two ways to arrive holding one.

    after login       the obvious case
    at bootstrap      a token already in storage — from an earlier session, or
                      from another app on a shared origin

  Both end the same way: sign out locally, then say plainly whose account it is
  and where to take it, with a working link.

  ⚠️ THIS IS NOT A SECURITY BOUNDARY, and must never be treated as one. The
  token remains valid and the server would still honour it. This is a wayfinding
  fix — the server's own permission checks are what stop a teacher reading a
  school's data (decisions 2.6 and 2.39).
==============================================================================*/

@Injectable({ providedIn: 'root' })
export class AppAccessService {
  private readonly identity = inject(JP_APP_IDENTITY);
  private readonly auth = inject(AuthService);

  private readonly noticeSignal = signal<WrongAppNotice | null>(null);

  /** Set when someone lands here with another app's account. */
  readonly notice = this.noticeSignal.asReadonly();

  /** True when the signed-in user belongs to this app. */
  readonly belongsHere = computed(() => {
    const user = this.auth.currentUser();

    return user === null ? false : appKeyForUserType(user.userType) === this.identity.key;
  });

  /**
   * Checks the current session against this app.
   *
   * Returns true when it is safe to proceed. Returns false having ALREADY
   * signed the user out locally and published a notice — the caller only has
   * to not navigate.
   */
  enforce(): boolean {
    const user = this.auth.currentUser();

    if (!user) {
      return false;
    }

    const belongsTo = appKeyForUserType(user.userType);

    if (belongsTo === this.identity.key) {
      this.noticeSignal.set(null);
      return true;
    }

    // Clear local state only. Calling the server's logout would revoke the
    // refresh token of a session the user is about to resume, correctly, on
    // the app they were heading for.
    this.auth.clearSession();

    this.noticeSignal.set(
      belongsTo === null ? this.unknownTypeNotice() : this.wrongAppNotice(belongsTo),
    );

    return false;
  }

  dismiss(): void {
    this.noticeSignal.set(null);
  }

  private wrongAppNotice(belongsTo: JpAppKey): WrongAppNotice {
    const url = this.identity.destinations[belongsTo];

    return {
      message: `That is ${APP_LABELS[belongsTo]}.`,
      // The hostname, not the raw URL — "Sign in at school.staffroom.in" reads
      // as a place, "https://school.staffroom.in/auth/login" reads as debris.
      actionLabel: `Sign in at ${hostOf(url)}`,
      url,
    };
  }

  /**
   * A utype the client does not recognise. Possible if the server adds a user
   * type before the frontend knows about it — say nothing we cannot stand
   * behind, and do not invent a destination.
   */
  private unknownTypeNotice(): WrongAppNotice {
    return {
      message: 'This account cannot be used here.',
      actionLabel: 'Contact support',
      url: 'mailto:support@staffroom.in',
    };
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    // Already a bare host, or something unparseable. Showing it as-is beats
    // showing nothing.
    return url;
  }
}
