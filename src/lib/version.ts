/*==============================================================================
  WHICH COPY OF jp-shared IS THIS?

  ----------------------------------------------------------------------------
  THE RISK THIS EXISTS TO MITIGATE
  ----------------------------------------------------------------------------
  Four standalone projects means four separate node_modules, and therefore four
  independent copies of this library. Someone fixes the auth interceptor here,
  syncs jp-admin, jp-school and jp-teacher, and forgets jp-public. That app
  carries the bug for weeks, and nothing anywhere reports it — every project
  builds cleanly against the copy it happens to have.

  A `file:` dependency cannot prevent that. Nothing can, short of a single
  workspace, which is precisely what the client did not want. So the goal is not
  prevention, it is making drift findable in SECONDS rather than after a user
  complains:

    1. this constant, stamped at build time from package.json
    2. each app logs it at bootstrap, in dev mode only
    3. `npm run check-shared-versions` at the repo root prints the installed
       version for all four apps side by side

  ⚠️ Do not delete any of the three thinking it is noise. Together they ARE the
  mitigation for the one real weakness of this structure.

  Bump the version whenever jp-shared changes in a way apps must pick up:
  `npm run version:bump` in jp-shared, then `npm run sync:all` at the root.
==============================================================================*/

/**
 * Kept in step with package.json by scripts/bump-version.mjs.
 *
 * Deliberately a literal rather than a package.json import: the apps consume
 * the compiled library, and reading package.json at runtime would need a
 * bundler resolution that differs between the four of them.
 */
export const JP_SHARED_VERSION = '1.0.0';

/**
 * Logs the loaded library version once, in development only.
 *
 * Called from each app's bootstrap. In production it does nothing — this is a
 * developer's tool for spotting drift, not something to print for users.
 */
export function logSharedVersion(appName: string, isDevMode: boolean): void {
  if (!isDevMode) {
    return;
  }

  // eslint-disable-next-line no-console
  console.info(
    `%c${appName}%c using @tarun1515/jp-shared %c${JP_SHARED_VERSION}`,
    'font-weight:600',
    'color:#52685f',
    'font-weight:600;color:#234a40',
  );
}
