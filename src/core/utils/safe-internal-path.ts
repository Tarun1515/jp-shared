/*==============================================================================
  IS THIS STRING A PATH INSIDE THIS APP, OR IS IT SOMEBODY ELSE'S WEBSITE?

  ----------------------------------------------------------------------------
  🔒 THE OPEN-REDIRECT DEFENCE. 7B-0.
  ----------------------------------------------------------------------------
  A return URL arrives in a query parameter, which means anybody can set it —
  including in a link they send to somebody else. The attack is a link that
  looks like ours:

      https://teacher.staffroom.in/auth/login?returnUrl=https://evil.example

  The visitor checks the hostname, sees ours, signs in, and is handed to a page
  they did not choose — which may be a convincing copy of the one they just
  left, now asking for the password again. The domain in the address bar was
  genuinely ours right up to the moment it was not.

  ----------------------------------------------------------------------------
  ⚠️ NO ANGULAR IMPORTS IN THIS FILE, DELIBERATELY
  ----------------------------------------------------------------------------
  It is a pure function with no dependencies so that it can be imported and
  table-tested directly by a verification script, without a browser and
  without the DI container. A security check whose only test is an end-to-end
  one gets tested on the two cases somebody thought of while writing the page.

  ⚠️ It is also the reason the function does not live in ReturnUrlService: the
  service needs JP_APP_IDENTITY, and anything importing it pulls in Angular.
==============================================================================*/

/**
 * The longest return URL worth keeping.
 *
 * ⚠️ Not a security control — the checks below are. This stops a pathological
 * value (a megabyte of query string) reaching storage, where it would sit
 * until the tab closed.
 */
const MAX_LENGTH = 512;

/**
 * A throwaway origin to resolve against.
 *
 * `.invalid` is reserved by RFC 2606 and can never be a real host, so even if
 * a crafted value resolved against it, the result could not name anywhere
 * reachable.
 */
const PROBE_ORIGIN = 'https://jp.invalid';

/**
 * ASCII control characters, space and DEL.
 *
 * ⚠️ Written as an explicit range rather than `[\u0000- \u007f]`, which reads
 * as though it might mean "everything up to DEL" and actually means
 * "0x00 to 0x20, plus 0x7f". The same characters, far less to re-derive.
 */
const CONTROL_OR_SPACE = /[\u0000- \u007f]/;

/**
 * The candidate as a safe app-relative path, or null.
 *
 * ⚠️ `startsWith('/')` ALONE IS NOT ENOUGH, and that is the usual mistake:
 *
 *     //evil.example     a protocol-relative URL. Starts with '/', and a
 *                        browser treats it as absolute on that host.
 *     /\evil.example     browsers fold the backslash to '/', recreating the
 *                        case above. Internet Explorer started this; every
 *                        engine kept it.
 *     /\/evil.example    the same, padded.
 *     /%0D%0A...         control characters, which some parsers strip before
 *                        resolving and some do not.
 *
 * So the rules are layered: a shape check, an explicit ban on the characters
 * that defeat it, and a structural check that the resolved URL is still on the
 * throwaway origin. The last would catch a case the first two missed, which is
 * the point of having it.
 *
 * ⚠️ WHAT THIS DOES NOT DO: it does not check the path against the app's route
 * table. An allowlist would be stronger, but it would have to be kept in step
 * with every route in three applications, and a stale allowlist fails by
 * turning a legitimate destination silently into the dashboard. The boundary
 * defended here is the ORIGIN — that whatever arrives, the visitor stays
 * inside this app. A path that does not exist renders the app's own 404, which
 * is a bad link rather than a handover.
 */
export function safeInternalPath(candidate: string | null | undefined): string | null {
  if (!candidate) {
    return null;
  }

  if (candidate.length > MAX_LENGTH) {
    return null;
  }

  /* App-relative: exactly one leading slash. */
  if (!candidate.startsWith('/')) {
    return null;
  }

  /* Protocol-relative — '//host' is absolute to a browser. */
  if (candidate.startsWith('//')) {
    return null;
  }

  /* A backslash anywhere: browsers fold '\' to '/', recreating the above. */
  if (candidate.includes('\\')) {
    return null;
  }

  if (CONTROL_OR_SPACE.test(candidate)) {
    return null;
  }

  try {
    const resolved = new URL(candidate, PROBE_ORIGIN);

    /* The structural backstop. */
    if (resolved.origin !== PROBE_ORIGIN) {
      return null;
    }

    /*
      Rebuilt from the parsed parts rather than returned as given, so the router
      receives something normalised ('/a/./b' -> '/a/b') that cannot carry
      anything the parse did not recognise.
    */
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    /* Unparseable is not safe. */
    return null;
  }
}
