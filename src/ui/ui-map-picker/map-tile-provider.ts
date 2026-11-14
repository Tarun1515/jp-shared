import { InjectionToken } from '@angular/core';

/*==============================================================================
  WHERE THE MAP TILES COME FROM

  🔴 NO API KEY REACHES THE BROWSER. That is the standing rule this whole area
  was built around — the same rule that keeps the Places key behind
  JP.Sso.Api in AddressLookupService — and it is why the map is OpenStreetMap
  rather than Google. OSM's standard tiles need no key, no SDK and no script
  tag, so there is nothing to leak. There is no Google Maps script anywhere in
  this library and there must not be one.

  ⚠️ THE TILE SOURCE SITS BEHIND THIS ONE SETTING so that changing it is
  configuration rather than a rewrite. Both halves of a tile source — the URL
  template and the attribution that licences it — live in the SAME object, so
  they cannot be changed independently. That pairing is the point: a URL
  swapped without its attribution is a licence breach, and an attribution left
  pointing at a source we no longer use is a lie.

  Provided with a default, unlike JP_API_CONFIG, which every app must provide:
  an app that says nothing gets OSM, which is the shipped answer. Overriding is
  a provider in the app's bootstrap:

      { provide: JP_MAP_TILE_PROVIDER, useValue: { …another source… } }

  ----------------------------------------------------------------------------
  🔴 IF GOOGLE IS EVER WANTED, THE KEY STILL DOES NOT COME HERE
  ----------------------------------------------------------------------------
  Google has no keyless tile URL. Its Map Tiles API wants a key and a session
  token, and putting either in `urlTemplate` would put it in the browser — the
  one thing this component may never do. The swap is therefore:

    1. JP.App.Api grows a tile endpoint that holds the key server-side and
       proxies `{z}/{x}/{y}`;
    2. an app provides `urlTemplate: '<appApiUrl>/tiles/{z}/{x}/{y}'` and
       Google's required attribution here.

  Nothing in ui-map-picker changes for that, which is the whole reason this
  token exists. The same shape covers MapTiler, Stadia, Thunderforest or a
  self-hosted OSM render, all of which are a one-object change.
==============================================================================*/

export interface JpMapTileProvider {
  /**
   * Leaflet URL template, e.g. `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
   * `{s}` is only needed by sources that still shard across subdomains.
   */
  readonly urlTemplate: string;

  /**
   * 🔴 A LICENCE REQUIREMENT, NOT DECORATION. OSM tiles may only be used with
   * visible credit, so this renders inside the map and nothing hides it.
   *
   * ⚠️ Leaflet writes this into the attribution control as HTML, so a link is
   * a real link. That is safe because this value is OUR configuration — it
   * never comes from a user, an API response or a query string, and it must
   * not be wired to anything that does.
   */
  readonly attributionHtml: string;

  /** Deepest zoom the source actually serves. OSM stops at 19. */
  readonly maxZoom: number;

  /** Only for sources that shard, e.g. `'abc'`. OSM no longer wants this. */
  readonly subdomains?: string | string[];

  /** 512 for the retina-native sources. Omit for the usual 256. */
  readonly tileSize?: number;

  /** Goes with `tileSize: 512` — usually -1. */
  readonly zoomOffset?: number;
}

/**
 * The default: OpenStreetMap's own standard tiles.
 *
 * ⚠️ `tile.openstreetmap.org`, NOT `{s}.tile.openstreetmap.org`. The sharded
 * form is the old advice; the single hostname is what OSM asks for now, and
 * three subdomains buy nothing over HTTP/2.
 *
 * ⚠️ THE BROWSER FETCHES THESE DIRECTLY FROM openstreetmap.org. No key, and
 * nothing of ours travels with the request beyond the tile coordinates and the
 * user's IP — but it IS a third-party request, so if the client ever wants it
 * to stop, the fix is a provider pointing at our own proxy (see above) rather
 * than a change to the component.
 *
 * ⚠️ `detectRetina` is deliberately NOT set: it doubles the number of tiles
 * fetched, and OSM's tile policy is a courtesy we are living on.
 */
export const OSM_TILE_PROVIDER: JpMapTileProvider = {
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attributionHtml:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">'
    + 'OpenStreetMap</a> contributors',
  maxZoom: 19,
};

export const JP_MAP_TILE_PROVIDER = new InjectionToken<JpMapTileProvider>(
  'JP_MAP_TILE_PROVIDER',
  { factory: () => OSM_TILE_PROVIDER },
);
