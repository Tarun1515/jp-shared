import { Injectable, inject } from '@angular/core';
import { JP_APP_IDENTITY, scopedStorageKey } from '../app-identity';
import { STORAGE_KEYS } from '../constants/auth-constants';

/**
 * Reads and writes the access and refresh tokens.
 *
 * localStorage keeps the session alive across tabs and reloads, which this
 * application needs. The trade-off is that it is readable by any script on the
 * page, so a stored token is only as safe as the app is free of XSS — hence
 * strict template binding everywhere and no `bypassSecurityTrust*` without a
 * concrete reason.
 *
 * Every access goes through here rather than touching localStorage directly
 * (decision 2.19), so moving to a different store later is a change in one file.
 *
 * ----------------------------------------------------------------------------
 * KEYS ARE PREFIXED PER APP
 * ----------------------------------------------------------------------------
 * `jp.admin.accessToken`, `jp.school.accessToken`, `jp.teacher.accessToken`.
 *
 * We intend to deploy on subdomains, and separate origins already isolate
 * localStorage. The prefix exists so that isolation does not DEPEND on that
 * deployment decision holding: put two apps on one host — a shared staging box,
 * a path-based reverse proxy, someone testing on localhost — and unprefixed
 * keys mean the teacher app silently picks up the school app's token, sends it
 * to the same SSO API, gets a valid response, and lands the user in a shell
 * built for someone else.
 *
 * The prefix comes from JP_APP_IDENTITY, which each app provides at bootstrap.
 * There is no default: a missing provider is an injection error at startup,
 * not a silent fallback to a shared key.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly identity = inject(JP_APP_IDENTITY);

  private readonly accessTokenKey = this.scoped(STORAGE_KEYS.accessToken);
  private readonly refreshTokenKey = this.scoped(STORAGE_KEYS.refreshToken);

  getAccessToken(): string | null {
    return this.read(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    return this.read(this.refreshTokenKey);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.write(this.accessTokenKey, accessToken);
    this.write(this.refreshTokenKey, refreshToken);
  }

  clear(): void {
    this.remove(this.accessTokenKey);
    this.remove(this.refreshTokenKey);
  }

  /**
   * ⚠️ Moved to `scopedStorageKey` in app-identity.ts in 7B-0, because the
   * pending return URL needs the same prefixing and a second copy of this rule
   * is how two stores end up disagreeing about where they live. The keys it
   * produces are identical.
   */
  private scoped(key: string): string {
    return scopedStorageKey(key, this.identity.key);
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      // Safari in private mode, and any browser with storage disabled, throw
      // on access rather than returning null.
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Nothing useful to do — the session simply will not survive a reload.
    }
  }

  private remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore, as above.
    }
  }
}
