/*==============================================================================
  HOW FAR IS THE PIN FROM THE ADDRESS?

  One pure function, no Leaflet, no DOM, no Angular — so the apps can call it
  in a computed, and a suite can call it in Node without a browser.

  ----------------------------------------------------------------------------
  🔴 THIS IS THE BROWSER'S NUMBER. THE SERVER'S IS THE ONE THAT DECIDES.
  ----------------------------------------------------------------------------
  This is a plain haversine on a sphere. The server measures with `STDistance`
  on a `geography` column, which is WGS-84 ellipsoidal — a different shape of
  the earth, not a different quality of arithmetic.

  ⚠️ THEY WILL NOT AGREE TO THE METRE, and they are not meant to. Over the
  distances that matter here the two differ by roughly 0.1–0.5% — a few metres
  over a kilometre, tens of metres over a hundred. So:

    • THIS function exists for one sentence in the browser: "your pin is X km
      from your address". It is a reassurance, printed to one decimal place,
      and a few metres of disagreement is invisible in it.

    • ANY DECISION — a radius search, a verification rule, a "too far from the
      stated address" flag, anything stored or acted on — uses the server's
      `STDistance`. Never this.

  🔴 DO NOT make this agree with the server by "improving" it. If a decision
  ever needs to be made in the browser, the right move is to ask the server for
  the distance, not to reimplement Vincenty here and hope two implementations
  stay in step.
==============================================================================*/

/**
 * Mean earth radius (IUGG), in kilometres.
 *
 * ⚠️ A sphere of this radius is the haversine's whole model of the planet.
 * Nudging it is how you make a function that is wrong in a new way.
 */
const EARTH_MEAN_RADIUS_KM = 6371.0088;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Great-circle distance between two points, in kilometres.
 *
 * ⚠️ Garbage in, `NaN` out — on purpose. A pure function that silently
 * returned 0 for a missing coordinate would make "your pin is at your address"
 * the message for "we have no pin", which is the one wrong answer that reads as
 * right. Callers that may hold nulls check `Number.isFinite` on the result;
 * `<ui-map-picker>` does exactly that before it prints anything.
 *
 * @example
 * distanceKm(28.6139, 77.2090, 28.4595, 77.0266);  // ≈ 24.2 — Delhi to Gurugram
 */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const deltaLat = toRadians(bLat - aLat);
  const deltaLng = toRadians(bLng - aLng);

  const halfChordLat = Math.sin(deltaLat / 2);
  const halfChordLng = Math.sin(deltaLng / 2);

  const h = (halfChordLat * halfChordLat)
    + (Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * halfChordLng * halfChordLng);

  /*
    ⚠️ `Math.min(1, …)` is not defensive clutter. Floating point can push `h`
    a hair above 1 for near-antipodal points, and `Math.asin` of anything above
    1 is NaN — a distance that vanishes at exactly the point it is largest.
  */
  return 2 * EARTH_MEAN_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
