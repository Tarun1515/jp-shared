/*==============================================================================
  DOES *THIS* APP HAVE A ROUTE FOR THIS PATH?

  ----------------------------------------------------------------------------
  🔴 WHY THIS EXISTS — A NOTIFICATION THAT NAVIGATES INTO A 404
  ----------------------------------------------------------------------------
  Notifications carry a server-written `ActionUrl`, and the bell navigates to
  it. Every value the database writes is a school- or teacher-side path:

      /applications  /offers  /applicants  /invitations
      /teacher-search/invites  /profile
      (021_notifications.sql:250,337,353,433,447; 022_teacher_verification.sql:158)

  None of those is registered in jp-admin. The bell is rendered by the SHARED
  shell, so it is on every admin screen too — and because every app ends in a
  `**` catch-all, `navigateByUrl` does not fail. It *succeeds*, into the
  "we cannot find that page" screen. The person is told the app is broken when
  the only wrong thing was the destination.

  ⚠️ Measured 15 Nov 2026: latent today. `t_app_notifications` holds 0 rows and
  no code path addresses a notification to an admin recipient. This guard is
  here so that the day one is addressed to an admin — which is a one-row change
  in a procedure, not a redesign — the bell degrades to "no link" instead of
  "404".

  ----------------------------------------------------------------------------
  ⚠️ THIS IS NOT `safeInternalPath`, AND BOTH ARE NEEDED
  ----------------------------------------------------------------------------
  `safeInternalPath` answers "is this a path rather than somebody else's
  website" — a SECURITY question, and it deliberately imports nothing from
  Angular. This answers "does this app serve that path" — a ROUTING question
  that cannot be answered without the route table. A string can pass the first
  and fail this one, which is exactly the notification case.

  ----------------------------------------------------------------------------
  ⚠️ THE WILDCARD IS EXCLUDED ON PURPOSE
  ----------------------------------------------------------------------------
  `**` matches everything, so counting it would make this function always
  return true and quietly do nothing. Excluding it is the whole point.
==============================================================================*/

import type { Route, Routes } from '@angular/router';

/** The first path segment of a route path or URL, or '' for the root. */
function firstSegment(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0] ?? '';

  for (const part of withoutQuery.split('/')) {
    if (part !== '') {
      return part;
    }
  }

  return '';
}

/**
 * Every concrete first segment this route table can serve.
 *
 * ⚠️ A pathless or empty-path parent is TRANSPARENT: the shell route in each
 * app is `{ path: '', children: [...] }`, so its children's paths are the real
 * top-level segments. Not recursing would see one empty path and conclude the
 * app serves nothing.
 */
function collectFirstSegments(routes: Routes, into = new Set<string>()): Set<string> {
  for (const route of routes as Route[]) {
    const path = route.path;

    if (path === '**') {
      continue;
    }

    if (path === undefined || path === '') {
      into.add('');

      if (route.children) {
        collectFirstSegments(route.children, into);
      }

      continue;
    }

    into.add(firstSegment(path));
  }

  return into;
}

/**
 * True when this app's route table has something for `path` other than its
 * catch-all. A parameterised route (`applications/:id`) is matched on its
 * first segment, which is as far as a destination check needs to go: the
 * screen itself already has an honest not-found state for an id it cannot
 * load, and that is a different and better message than a 404 page.
 */
export function appHandlesPath(routes: Routes, path: string | null | undefined): boolean {
  if (!path) {
    return false;
  }

  return collectFirstSegments(routes).has(firstSegment(path));
}
