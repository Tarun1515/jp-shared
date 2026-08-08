import { HttpClient } from '@angular/common/http';
import { JP_API_CONFIG } from '../app-identity';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { ApiResponse } from '../models/api-response.model';
import { MenuItem, MenuNode } from '../models/menu.model';
import { AuthService } from './auth.service';

/**
 * The signed-in user's navigation, fetched from the server.
 *
 * Replaces the hardcoded NavItem arrays that used to live in each layout
 * component. Those broke decision 2.7, but the practical problem was worse:
 * from Phase 2 onward screens are added constantly, and a frontend build and
 * deploy for every menu change is not a workable release process.
 *
 * ⚠️ THIS IS PRESENTATION, NOT PROTECTION.
 * The menu decides what is SHOWN. permissionGuard and the server decide what
 * is ALLOWED, and both stay exactly where they are. A hidden menu item has
 * never stopped anyone typing a URL.
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly api = inject(JP_API_CONFIG);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly menusSignal = signal<MenuItem[]>([]);
  private readonly loadedSignal = signal(false);
  private readonly loadingSignal = signal(false);

  /**
   * Whose menu is currently cached.
   *
   * Not a detail. Without it, signing out and signing in as someone else on
   * the same machine short-circuits the load and shows the PREVIOUS user's
   * navigation — clear() covers the deliberate sign-out, but a session dropped
   * by a 401 never passes through it.
   */
  private loadedForUserUid: string | null = null;

  /** Every entry the user may reach, visible in the sidebar or not. */
  readonly menus = this.menusSignal.asReadonly();

  /** True once a load has completed, successfully or not. */
  readonly loaded = this.loadedSignal.asReadonly();

  /**
   * The sidebar tree: visible entries only, nested, each level ordered.
   *
   * A group node whose children are all invisible is dropped — the server
   * already removes groups with no *permitted* children, this covers the
   * separate case of a group whose children are all detail pages.
   */
  readonly navigationTree = computed<MenuNode[]>(() => {
    const visible = this.menusSignal().filter((m) => m.isMenuVisible);
    const tree = buildTree(visible);

    return tree.filter((node) => node.routePath !== null || node.children.length > 0);
  });

  /**
   * Loads the menu once per session.
   *
   * Called after sign-in and after a page reload that restored a session.
   * Cheap enough to call defensively: it short-circuits once loaded.
   */
  load(force = false): Observable<MenuItem[]> {
    const userUid = this.auth.currentUser()?.userUid ?? null;

    if (userUid === null) {
      this.clear();
      return of([]);
    }

    if (userUid !== this.loadedForUserUid) {
      // Different person in the same tab. Whatever is cached belongs to
      // someone else.
      this.clear();
    } else if (!force && (this.loadedSignal() || this.loadingSignal())) {
      return of(this.menusSignal());
    }

    this.loadingSignal.set(true);
    this.loadedForUserUid = userUid;

    return this.http.get<ApiResponse<MenuItem[]>>(`${this.api.ssoApiUrl}/menus`).pipe(
      map((response) => response.data ?? []),
      // A failed menu load must not block the app. The user lands on their
      // home route with an empty sidebar and can still navigate directly;
      // every route is guarded on the server regardless.
      catchError(() => of([] as MenuItem[])),
      map((items) => {
        this.menusSignal.set(items);
        this.loadedSignal.set(true);
        return items;
      }),
      finalize(() => this.loadingSignal.set(false)),
    );
  }

  /** Drops the cached menu. Call on sign-out, and on any role change. */
  clear(): void {
    this.menusSignal.set([]);
    this.loadedSignal.set(false);
    this.loadedForUserUid = null;
  }

  /**
   * Whether a route appears in the user's menu at all.
   *
   * Matches on prefix so /school/jobs/42 resolves to the /school/jobs entry.
   * Intended for highlighting and for friendly "not available" copy — NOT as
   * an access check.
   */
  isRoutePermitted(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];

    return this.menusSignal().some(
      (m) => m.routePath !== null && (path === m.routePath || path.startsWith(`${m.routePath}/`)),
    );
  }
}

/** Nests a flat list on parentMenuId and orders every level. */
function buildTree(items: MenuItem[]): MenuNode[] {
  const byId = new Map<number, MenuNode>();

  for (const item of items) {
    byId.set(item.menuId, { ...item, children: [] });
  }

  const roots: MenuNode[] = [];

  for (const node of byId.values()) {
    // A child whose parent was filtered out is promoted to the root rather
    // than dropped. Losing a link the server said was permitted is the worse
    // failure of the two.
    const parent = node.parentMenuId === null ? undefined : byId.get(node.parentMenuId);

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const byOrder = (a: MenuNode, b: MenuNode) =>
    a.displayOrder - b.displayOrder || a.menuId - b.menuId;

  for (const node of byId.values()) {
    node.children.sort(byOrder);
  }

  return roots.sort(byOrder);
}
