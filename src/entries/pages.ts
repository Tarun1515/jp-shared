/*==============================================================================
  jp-shared/pages — routed pages every app needs and none should rewrite.

  Exposed over Native Federation. See the note in ./ui.ts about barrels.

  Routed components, so they are loaded through the router rather than a
  template. That makes them the one part of the shared surface that could also
  be reached with `loadRemoteModule` — but they go through the same import map
  as everything else, so there is one mechanism to understand rather than two.
==============================================================================*/

export * from '../core/pages/coming-soon/coming-soon.component';
export * from '../core/pages/forbidden/forbidden.component';
export * from '../core/pages/not-found/not-found.component';
