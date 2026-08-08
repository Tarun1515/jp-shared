/**
 * One navigation entry, exactly as GET /api/menus returns it.
 * Mirrors JP.Domain.Menus.MenuResponse.
 */
export interface MenuItem {
  menuId: number;

  /** Null for a top-level entry. The tree is built from this. */
  parentMenuId: number | null;

  /** Stable identifier. Match on this, never on menuId. */
  menuCode: string;

  menuName: string;

  /** Null for a group node — a heading whose children carry the links. */
  routePath: string | null;

  iconName: string | null;

  /**
   * The permission that gated this entry, or null if it needed none.
   *
   * The server has ALREADY applied it — this list never contains anything the
   * user may not see. It is here so the UI can explain an absence, not so the
   * UI can filter.
   */
  permissionCode: string | null;

  displayOrder: number;

  /**
   * False for routable-but-unlisted screens: detail pages, edit forms.
   * Those still arrive, because the same list answers "may this route be
   * opened at all".
   */
  isMenuVisible: boolean;

  openInNewTab: boolean;
}

/** A menu item with its children attached, ready to render. */
export interface MenuNode extends MenuItem {
  children: MenuNode[];
}
