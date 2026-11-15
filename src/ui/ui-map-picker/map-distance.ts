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

/*==============================================================================
  "~4 km away" — ONE WORDING FOR THE SERVER'S NUMBER (D1)

  ----------------------------------------------------------------------------
  🔴 THIS FORMATS THE SERVER'S METRES. IT DOES NOT COMPUTE A DISTANCE.
  ----------------------------------------------------------------------------
  Everything above this line is the BROWSER's haversine, for the one reassuring
  sentence `<ui-map-picker>` prints about its own pin. This function is the
  other half of that rule, and it is here rather than in a feature component so
  that the two never get confused for each other:

      distanceKm()           computes — browser, sphere, ±0.5%, display only
      distanceAwayLabel()    formats — takes STDistance's metres off the wire

  It is in this file because this is where the project's distance reasoning
  already lives, and because a label like this one tends to be re-typed per
  screen until there are three wordings of the same fact. The job card, the job
  detail page and whatever asks next all read this.

  ----------------------------------------------------------------------------
  🔴 NULL IN, NULL OUT — AND THAT IS THE WHOLE RULE OF WHEN THE LABEL APPEARS
  ----------------------------------------------------------------------------
  The server sends `distanceMetres: null` whenever EITHER pin is missing — the
  teacher has not pinned themselves, or the campus has no pin. There is no
  city-centroid fallback anywhere in the chain, by decision: a town centroid is
  not where anybody lives, and "~4 km away" measured from one is a sentence the
  product states as fact and cannot support (041's header argues it in full).

  So "both pins exist" is not a second condition a caller has to remember — it
  is exactly `distanceMetres !== null`, and returning null here means the
  template renders nothing. 🔴 Callers must not substitute a 0, a dash or
  "Distance unknown": a card that says nothing about distance is correct, and a
  card that says "0 km away" is wrong in the one way that reads as right.

  ----------------------------------------------------------------------------
  ⚠️ WHOLE KILOMETRES, AND THE "~" IS DOING REAL WORK
  ----------------------------------------------------------------------------
  `STDistance` is a STRAIGHT LINE over the ellipsoid. The commute is a road, and
  a road is routinely half again as long — so "4.2 km" would advertise a
  precision the number does not have, about a journey it is not measuring.
  Whole kilometres with a leading "~" says what this is: an estimate of how far
  away, not a trip length. Somebody deciding whether a job is reachable needs
  the order of magnitude and nothing finer.

  ⚠️ UNDER A KILOMETRE IS A BOUND, NOT AN ESTIMATE, so it loses the "~" and
  says "Less than 1 km away". Two reasons: "~0 km away" is what rounding would
  produce for anything under 500 m, and a teacher pinned at their own school's
  gate would be told they are nowhere near it. Reporting metres instead
  ("~300 m away") would be the opposite mistake — a straight-line number given
  to a precision that implies we know which building.
==============================================================================*/

/** Below this, the distance is reported as a bound rather than an estimate. */
const BOUND_BELOW_METRES = 1000;

/**
 * How far away, in words — or null when there is nothing to say.
 *
 * @param metres Straight-line metres from the server, or null/undefined when
 *   either pin is missing.
 *
 * @example
 * distanceAwayLabel(4218);    // '~4 km away'
 * distanceAwayLabel(420);     // 'Less than 1 km away'
 * distanceAwayLabel(null);    // null  — render nothing
 */
export function distanceAwayLabel(metres: number | null | undefined): string | null {
  /*
    ⚠️ Number.isFinite REJECTS null, undefined, NaN AND Infinity in one test.
    A `!metres` check would also reject 0, which is a real distance — two pins
    at the same place — and would be the one case where "no label" is wrong.
    A negative is impossible from STDistance and is refused anyway: it means
    something upstream is broken, and the honest response to a number we cannot
    explain is to say nothing rather than to print it.
  */
  if (!Number.isFinite(metres as number) || (metres as number) < 0) return null;

  const m = metres as number;

  if (m < BOUND_BELOW_METRES) return 'Less than 1 km away';

  /*
    ⚠️ toLocaleString('en-IN') for the thousands grouping, matching how this
    product already prints rupees. It only ever shows for genuinely distant
    postings — "~1,800 km away" on a job in another state is useful information
    and not an error.
  */
  return `~${Math.round(m / 1000).toLocaleString('en-IN')} km away`;
}
