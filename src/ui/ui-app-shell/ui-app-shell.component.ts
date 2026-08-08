import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';

/**
 * The chrome shared by all three portals: header, side navigation, outlet.
 *
 * NAVIGATION COMES FROM THE SERVER (decision 2.37). It used to be a NavItem[]
 * input, with each layout carrying its own hardcoded array — which meant a
 * frontend build and deploy for every menu change, and three places to forget
 * to update. The layouts now supply only their section label; the tree is
 * whatever GET /api/menus returned for this user.
 *
 * Hiding a nav item the user cannot use is presentation, not protection. The
 * route still carries its own guard and the server still checks the
 * permission — this just avoids showing links that would bounce.
 */
@Component({
  selector: 'ui-app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './ui-app-shell.component.html',
  styleUrl: './ui-app-shell.component.scss',
})
export class UiAppShellComponent {
  readonly sectionTitle = input.required<string>();

  protected readonly auth = inject(AuthService);
  protected readonly menu = inject(MenuService);

  private readonly router = inject(Router);

  protected readonly navOpen = signal(false);

  /** Nested, ordered, visible entries only. Built on the client from parentMenuId. */
  protected readonly navigationTree = this.menu.navigationTree;

  /**
   * Who is signed in, in words.
   *
   * The role, not the user uid. A uid is an internal key: it means nothing to
   * the person reading it, takes the width of a headline, and is an identifier
   * there is no reason to print on every screen. The role is what someone
   * actually wants confirmed — "am I in as the owner or as HR".
   */
  protected readonly accountLabel = computed(() => {
    const roles = this.auth.currentUser()?.roles ?? [];

    if (!roles.length) {
      return null;
    }

    // SCHOOL_OWNER -> School owner
    const code = roles[0];

    return code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' ');
  });

  constructor() {
    /*
      Loaded here rather than in the login component, because this covers both
      entry points with one call: a fresh sign-in AND a page reload that
      restored a session from storage. All three layouts sit behind authGuard,
      so by the time this runs there is a user.

      load() short-circuits when the menu is already cached for THIS user, so
      switching between /school and /teacher chrome costs nothing.
    */
    this.menu.load().subscribe();
  }

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  protected logout(): void {
    // The menu is per-user, so it must not survive into the next session on a
    // shared machine.
    this.menu.clear();

    // Local state is already cleared synchronously inside logout(), so the
    // redirect is correct whether or not the server call succeeds.
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/auth/login']),
      error: () => void this.router.navigate(['/auth/login']),
    });
  }
}
