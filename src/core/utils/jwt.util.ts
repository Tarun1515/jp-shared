import { CLAIM_KEYS, UserStatus, UserType } from '../constants/auth-constants';
import { CurrentUser, JwtClaims } from '../models/auth.model';

/**
 * Decodes a JWT payload without verifying it.
 *
 * The signature is NOT checked here, and cannot be — the client has no key.
 * This exists only so guards can render the right screen without a round trip.
 * Every claim it produces is a display and routing hint; the server re-derives
 * all of it from the signed token before trusting anything.
 */
export function decodeJwt(token: string): JwtClaims | null {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(segments[1])) as JwtClaims;
  } catch {
    return null;
  }
}

/**
 * A JWT serialises a repeated claim as an array but a single occurrence as a
 * bare string. A user with exactly one role would otherwise arrive as a string
 * and iterate character by character.
 */
export function claimToArray(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/** Builds the CurrentUser view of a token, or null if it is unusable. */
export function toCurrentUser(token: string): CurrentUser | null {
  const claims = decodeJwt(token);
  if (!claims) {
    return null;
  }

  const userId = Number(claims[CLAIM_KEYS.userId]);
  const userType = Number(claims[CLAIM_KEYS.userType]);
  const status = Number(claims[CLAIM_KEYS.status]);

  if (!Number.isFinite(userId) || !Number.isFinite(userType) || !Number.isFinite(status)) {
    return null;
  }

  return {
    userId,
    userUid: claims[CLAIM_KEYS.userUid],
    userType: userType as UserType,
    status: status as UserStatus,
    organizationUid: claims[CLAIM_KEYS.organizationUid] ?? null,
    roles: claimToArray(claims[CLAIM_KEYS.roles]),
    permissions: claimToArray(claims[CLAIM_KEYS.permissions]),
    expiresOn: new Date(claims.exp * 1000),
  };
}

/** Whether a token is past its expiry, with optional leeway in seconds. */
export function isExpired(token: string, leewaySeconds = 0): boolean {
  const claims = decodeJwt(token);
  if (!claims?.exp) {
    return true;
  }

  return claims.exp * 1000 <= Date.now() + leewaySeconds * 1000;
}

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);

  // Round-trip through TextDecoder rather than using atob's output directly,
  // so a name with non-ASCII characters survives intact.
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
