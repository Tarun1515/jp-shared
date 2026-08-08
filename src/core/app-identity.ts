import { InjectionToken } from '@angular/core';
import { UserType } from './constants/auth-constants';

/*==============================================================================
  WHICH APP AM I?

  There are now three signed-in apps — admin, school, teacher — sharing one
  library, one SSO API and one set of tokens. Almost everything they share can
  be written without knowing which app it is running in. Two things cannot:

    1. THE STORAGE PREFIX. All three may end up on the same origin, and then a
       token written by one is readable by the others.
    2. THE CROSS-APP LOGIN GUARD. Every app authenticates against the same SSO
       API, so a school owner CAN successfully sign in on the teacher app. The
       token is genuinely valid; the app is simply the wrong one.

  Rather than have the library guess, each app provides this at bootstrap and
  the shared code reads it.
==============================================================================*/

/** The three signed-in apps. `public-site` is anonymous and provides none of this. */
export type JpAppKey = 'admin' | 'school' | 'teacher';

export interface JpAppIdentity {
  /**
   * Short key for this app. Used as the browser-storage prefix, so changing it
   * signs everyone out of this app — and only this app.
   */
  readonly key: JpAppKey;

  /** The user type this app serves. Anyone else is sent away by the guard. */
  readonly userType: UserType;

  /** How the app refers to itself in copy, e.g. "the school portal". */
  readonly label: string;

  /**
   * Where each user type actually belongs.
   *
   * Configured per environment rather than hardcoded: these are real hostnames
   * that differ between local, staging and production, and a hardcoded
   * `school.staffroom.in` in a local build sends a developer to production.
   */
  readonly destinations: Readonly<Record<JpAppKey, string>>;
}

export const JP_APP_IDENTITY = new InjectionToken<JpAppIdentity>('JP_APP_IDENTITY');

/** Maps a token's utype claim to the app that serves it. */
export function appKeyForUserType(userType: UserType): JpAppKey | null {
  switch (userType) {
    case UserType.Admin:
      return 'admin';
    case UserType.School:
      return 'school';
    case UserType.Teacher:
      return 'teacher';
    default:
      return null;
  }
}

/** How that app is named to a user who has arrived at the wrong one. */
export const APP_LABELS: Readonly<Record<JpAppKey, string>> = {
  admin: 'an administrator account',
  school: 'a school account',
  teacher: 'a teacher account',
};

/*==============================================================================
  API CONFIGURATION

  The library cannot import an app's `environment.ts` — that would be a
  dependency pointing the wrong way, and there are now four of them. Each app
  provides its own values through this token instead.
==============================================================================*/

export interface JpApiConfig {
  /** JP.Sso.Api base, including `/api`. */
  readonly ssoApiUrl: string;

  /** JP.App.Api base, including `/api`. */
  readonly appApiUrl: string;

  /**
   * Refresh the access token this many seconds before it actually expires, so
   * a request is never sent with a token that dies in flight.
   */
  readonly tokenRefreshLeewaySeconds: number;
}

export const JP_API_CONFIG = new InjectionToken<JpApiConfig>('JP_API_CONFIG');
