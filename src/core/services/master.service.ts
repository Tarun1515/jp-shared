import { HttpClient } from '@angular/common/http';
import { JP_API_CONFIG } from '../app-identity';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay, throwError } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';
import { Lookup, MasterKey } from '../models/lookup.model';

/**
 * Master data with an in-memory cache.
 *
 * Master tables change roughly never, and a form with six dropdowns would
 * otherwise fire six requests every time it opens. The cache holds the
 * Observable rather than the array, so simultaneous callers during the first
 * load share one in-flight request instead of racing to issue their own.
 *
 * No dropdown value in this application is hardcoded — every one comes from
 * here, which is what makes adding a subject or a board a data change rather
 * than a deployment.
 */
@Injectable({ providedIn: 'root' })
export class MasterService {
  private readonly api = inject(JP_API_CONFIG);
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<Lookup[]>>();

  /** Fetches one master, from cache when already loaded. */
  get(key: MasterKey): Observable<Lookup[]> {
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const request = this.http
      .get<ApiResponse<Lookup[]>>(`${this.api.appApiUrl}/masters/${key}`)
      .pipe(
        map((response) => response.data ?? []),
        catchError((error: unknown) => {
          // Evict on failure. shareReplay would otherwise cache the error and
          // replay it to every future caller, so one flaky request would
          // permanently break the dropdown for the rest of the session.
          this.cache.delete(key);
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.cache.set(key, request);
    return request;
  }

  /**
   * Fetches a dependent master — states within a country, cities within a
   * district. Cached per parent.
   */
  getByParent(key: MasterKey, parentId: number): Observable<Lookup[]> {
    const cacheKey = `${key}:${parentId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const request = this.http
      .get<ApiResponse<Lookup[]>>(`${this.api.appApiUrl}/masters/${key}`, {
        params: { parentId },
      })
      .pipe(
        map((response) => response.data ?? []),
        catchError((error: unknown) => {
          this.cache.delete(cacheKey);
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.cache.set(cacheKey, request);
    return request;
  }

  /**
   * Warms the cache with the masters used across most screens. Called once
   * after sign-in so the first form to open does not pay for the load.
   */
  preload(keys: MasterKey[]): Observable<void> {
    if (keys.length === 0) {
      return of(undefined);
    }

    return forkJoin(keys.map((key) => this.get(key))).pipe(map(() => undefined));
  }

  /** Drops a single master, or everything. Use after an admin edits masters. */
  invalidate(key?: MasterKey): void {
    if (!key) {
      this.cache.clear();
      return;
    }

    this.cache.delete(key);

    // Dependent entries are keyed "<key>:<parentId>" and must go too.
    for (const cacheKey of [...this.cache.keys()]) {
      if (cacheKey.startsWith(`${key}:`)) {
        this.cache.delete(cacheKey);
      }
    }
  }
}
