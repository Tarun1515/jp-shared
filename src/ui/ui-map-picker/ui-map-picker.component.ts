import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender,
  computed, effect, inject, input, output, signal, untracked, viewChild,
} from '@angular/core';

/*
  ⚠️ `import type`, AND THE REAL IMPORT IS DYNAMIC (see `loadLeaflet`). A static
  `import * as L from 'leaflet'` here would put Leaflet into the eager graph of
  the `jp-shared/ui` barrel — which every app loads at boot for the app shell —
  so every page in four apps would download a map library to render a sidebar.
  A type-only import costs nothing at runtime and is erased by the compiler.
*/
import type * as LeafletNs from 'leaflet';

import { distanceKm } from './map-distance';
import { JP_MAP_TILE_PROVIDER } from './map-tile-provider';

/** The Leaflet namespace, once it has been loaded. */
type Leaflet = typeof LeafletNs;

/** The pin, in the shape the hosts store and the shape `(picked)` emits. */
export interface UiMapPoint {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Where the map looks when it has nothing at all to show: India, whole.
 *
 * ⚠️ NOT a city. A school with no address yet must not be shown a map centred
 * on Delhi, which reads as "we think you are in Delhi" and is wrong for most of
 * the country.
 */
const INDIA_CENTRE: readonly [number, number] = [22.5937, 78.9629];
const INDIA_ZOOM = 4;

/** Close enough to see which building is which, once there is a pin. */
const PIN_ZOOM = 16;

/**
 * Two coordinates this close are the same pin.
 *
 * 1e-6° is about 11 cm — far below anything a pin on a 320px map can express,
 * and far below what the difference between two roundings of the same number
 * can be. See THE EMIT LOOP note on the class.
 */
const SAME_POINT_EPSILON = 1e-6;

/** Below this, "your pin is N m away" is noise about the same spot. */
const SAME_PLACE_KM = 0.05;

/** Unique ids per instance, so label / description wiring cannot collide. */
let nextControlId = 0;

/** A finite coordinate pair, or null for "there is no coordinate here". */
function toPoint(latitude: number | null, longitude: number | null): UiMapPoint | null {
  /*
    ⚠️ RANGE-CHECKED, NOT JUST NULL-CHECKED. The hosts keep manual number
    inputs beside this map, and a half-typed `28.` or a pasted `770266` arrives
    here as a real number. Leaflet does not refuse an impossible latitude — it
    places the marker somewhere off the world and leaves the map looking broken.
    Treating it as "no coordinate" leaves the previous pin alone, which is the
    only harmless reading of a value that cannot be a place.
  */
  if (latitude === null || longitude === null) {
    return null;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { latitude, longitude };
}

function samePoint(a: UiMapPoint | null, b: UiMapPoint | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  return Math.abs(a.latitude - b.latitude) < SAME_POINT_EPSILON
    && Math.abs(a.longitude - b.longitude) < SAME_POINT_EPSILON;
}

/** "260 m" / "1.2 km" — one decimal is all this sentence can honestly carry. */
function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/**
 * Does this user want less movement?
 *
 * ⚠️ ASKED HERE AND HANDED TO LEAFLET, rather than answered in CSS with
 * `transition: none` the way the rest of this design system does it. Leaflet
 * ends a zoom when the browser reports `transitionend`; a stylesheet that
 * removes the transition removes the event, and the map is left mid-zoom
 * wearing a class it will never clear. Leaflet's own options take a
 * non-animated code path instead, which is the supported way to ask.
 *
 * ⚠️ Also the only `window` access in this file, and it is reached only from
 * `create()`, which only ever runs after a browser has rendered.
 */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Leaflet, loaded on first use.
 *
 * 🔴 DYNAMIC, FOR THREE REASONS AT ONCE: it keeps a map library out of the
 * `jp-shared/ui` barrel's eager graph (see the import note above); it means
 * nothing touches `window` until a browser has rendered this component; and it
 * gives us somewhere to put the failure. A chunk that 404s, a corporate proxy
 * that eats it, a browser that refuses it — all of them land in the `catch`,
 * and the component then says so quietly instead of throwing inside a
 * half-filled registration form.
 *
 * ⚠️ THE INTEROP DANCE IS NOT OPTIONAL. leaflet@1.9.4 ships a UMD/CommonJS
 * entry point and declares no `module`/`exports` field, so a bundler hands us
 * `{ default: <the namespace> }`, while a future ESM build would hand us the
 * namespace itself. Reading `.default` first and falling back covers both, and
 * the `typeof ns.map` check means a third shape degrades to "the map could not
 * be loaded" rather than to a TypeError with no context.
 */
async function loadLeaflet(): Promise<Leaflet | null> {
  try {
    const mod: unknown = await import('leaflet');
    const ns = (mod as { default?: unknown }).default ?? mod;

    return typeof (ns as Leaflet).map === 'function' ? (ns as Leaflet) : null;
  } catch {
    return null;
  }
}

/**
 * A map with one draggable pin on it.
 *
 * @example
 * <ui-map-picker
 *   [latitude]="draft.latitude()"
 *   [longitude]="draft.longitude()"
 *   [anchorLatitude]="geocoded()?.latitude ?? null"
 *   [anchorLongitude]="geocoded()?.longitude ?? null"
 *   (picked)="onPinned($event)"
 * />
 *
 * ----------------------------------------------------------------------------
 * 🔴 THE PIN STARTS AT THE GEOCODED ADDRESS. TOUCHING THE MAP IS OPTIONAL.
 * ----------------------------------------------------------------------------
 * This is the client's mistake-proofing requirement, and it is the whole
 * reason `anchorLatitude`/`anchorLongitude` exist as separate inputs. A school
 * that scrolls straight past this map must still end up with a sensible pin,
 * so when the host has no coordinates and an anchor is present, the pin is
 * placed there AND `(picked)` fires once so the host stores it. Nobody has to
 * drag anything for the record to be complete.
 *
 * ⚠️ IT IS AN ADDITION, NEVER THE ONLY WAY TO SET COORDINATES. The hosts keep
 * their manual latitude/longitude number inputs; this map is a faster, more
 * obvious path to the same two numbers. So it has to tolerate coordinates it
 * did not produce — typed, pasted, migrated, or set by a screen that predates
 * it — and it must not argue with them.
 *
 * ----------------------------------------------------------------------------
 * 🔴 THE EMIT LOOP, AND WHY THIS COMPONENT DOES NOT HAVE ONE
 * ----------------------------------------------------------------------------
 * The obvious failure of a control like this is a loop: the map emits, the host
 * writes it into a number input, the input flows back in, the map treats that
 * as a move and emits again. Two rules stop it, and they are the two rules to
 * keep if this file is ever rewritten:
 *
 *   1. AN INPUT CHANGE NEVER EMITS. `(picked)` fires in exactly four places —
 *      a finished marker drag, a click on the map, the Reset button, and the
 *      one seed described above. The input→marker path is strictly one-way.
 *      `marker.setLatLng()` does not raise Leaflet's `dragend`, so moving the
 *      pin in code cannot be mistaken for someone moving it.
 *
 *   2. COORDINATES ARE COMPARED WITH A TOLERANCE, never with `!==`. The host
 *      may round what we emit — 6 decimals, a `decimal(9,6)` column, a number
 *      input that re-parses its own text — and the value that comes back is
 *      then a few bits different from the one we sent. With `!==` that is a
 *      change, and the marker would jump on every keystroke; with
 *      SAME_POINT_EPSILON it is the same pin, and nothing happens.
 *
 * ⚠️ THE HOST IS THE SOURCE OF TRUTH, DELIBERATELY. While `latitude` and
 * `longitude` hold a usable pair, the marker goes where they say — including
 * back, if a host declines to store what the user just dragged. That is not a
 * fight with the host, it is the opposite: the map shows the host's state.
 *
 * ----------------------------------------------------------------------------
 * ⚠️ WHAT A KEYBOARD CAN AND CANNOT DO HERE
 * ----------------------------------------------------------------------------
 * CAN: reach and press "Reset to address location"; focus the map and pan it
 * with the arrow keys and zoom it with `+`/`-` (Leaflet's own keyboard
 * handler); reach the zoom buttons.
 *
 * CANNOT: place or move the pin. Dragging a marker is a pointer gesture and
 * Leaflet offers no keyboard equivalent, so the keyboard path to a precise
 * coordinate is the host's number inputs — which is exactly why this control
 * is an addition to them and not a replacement for them. The pin's own marker
 * is therefore NOT a tab stop (`keyboard: false`): a stop that cannot do
 * anything is a trap, not an affordance. What the keyboard user gets instead is
 * the live status line, which says how far the pin is from the address every
 * time it moves.
 */
@Component({
  selector: 'ui-map-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-map-picker.component.html',
  styleUrl: './ui-map-picker.component.scss',
})
export class UiMapPickerComponent {
  private readonly zone = inject(NgZone);
  private readonly provider = inject(JP_MAP_TILE_PROVIDER);

  /** The map's own element. Always rendered, so `required` cannot miss. */
  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');

  /** The current pin, or null. */
  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);

  /**
   * The geocoded address point: where "Reset" goes, and what the distance is
   * measured from.
   *
   * ⚠️ NOT the same thing as the pin, and never written to by this component.
   * The address says where the school said it is; the pin says where it is.
   * Keeping them apart is what makes "your pin is 2.4 km from your address"
   * sayable at all.
   */
  readonly anchorLatitude = input<number | null>(null);
  readonly anchorLongitude = input<number | null>(null);

  /** Show the pin, allow nothing: the admin's read view before they correct it. */
  readonly readonly = input(false);

  readonly heightPx = input(320);

  readonly label = input('Pin your location on the map');

  /** Fires whenever the pin moves. See THE EMIT LOOP note above. */
  readonly picked = output<UiMapPoint>();

  /** Where this component believes the pin is. */
  private readonly pin = signal<UiMapPoint | null>(null);

  /** The map is live. Until then the canvas is an empty box with a note on it. */
  protected readonly ready = signal(false);

  /** Leaflet or its tiles did not arrive. Quiet, and never blocking. */
  protected readonly mapUnavailable = signal(false);

  protected readonly controlId = `map-picker-${++nextControlId}`;
  protected readonly labelId = `${this.controlId}-label`;
  protected readonly hintId = `${this.controlId}-hint`;

  protected readonly anchor = computed(() => toPoint(this.anchorLatitude(), this.anchorLongitude()));

  private readonly hostPin = computed(() => toPoint(this.latitude(), this.longitude()));

  /**
   * ⚠️ HIDDEN WITH NO ANCHOR, because a "Reset to address location" that resets
   * to nothing is a button that lies. Hidden in `readonly` because the read
   * view has no actions at all.
   */
  protected readonly showReset = computed(() => !this.readonly() && this.anchor() !== null);

  protected readonly hint = computed(() => (this.readonly()
    ? 'The pin shows the location saved for this address.'
    : 'Drag the pin, or click anywhere on the map, to move it. '
      + 'Typing the latitude and longitude yourself works just as well.'));

  /**
   * The one sentence this control says about itself.
   *
   * 🔴 IT IS A LIVE REGION (see the template), so it is also the only feedback
   * a screen-reader user gets when the pin moves — which is why it says how far
   * away the pin is rather than just "moved".
   */
  protected readonly status = computed<string | null>(() => {
    /*
      ⚠️ HALF A SENTENCE, AND THE OTHER HALF IS THE PLACEHOLDER OVER THE BOX
      ("The map could not be loaded."). Said in both places it stutters; said
      only here the empty box goes unexplained. The box says what happened, this
      says what to do — do not merge them back together.

      ⚠️ IT NAMES NO CONTROL. "Enter it below" would point at a box that may be
      above this map, or beside it: the host decides where its number inputs
      live. The same lesson <ui-address-search> learned about telling somebody
      to "pick it below".
    */
    if (this.mapUnavailable()) {
      return 'You can still type the latitude and longitude yourself.';
    }

    const pin = this.pin();

    if (pin === null) {
      return this.readonly()
        ? 'No location is pinned.'
        : 'No pin yet — click or tap the map to place one.';
    }

    const anchor = this.anchor();

    if (anchor === null) {
      return null;
    }

    const km = distanceKm(pin.latitude, pin.longitude, anchor.latitude, anchor.longitude);

    if (!Number.isFinite(km)) {
      return null;
    }

    return km < SAME_PLACE_KM
      ? 'Pinned at the address you entered.'
      : `Your pin is ${formatDistance(km)} from the address you entered.`;
  });

  // ---------------------------------------------------------------------------
  // Leaflet's own objects. Imperative, so plain fields rather than signals —
  // a signal nobody reads is just a field with ceremony.
  // ---------------------------------------------------------------------------
  private leaflet: Leaflet | null = null;
  private map: LeafletNs.Map | null = null;
  private marker: LeafletNs.Marker | null = null;

  /**
   * 🔴 THE ADDRESS POINT, DRAWN — WITHOUT IT THE READ VIEW WAS A LIE.
   *
   * The admin's campus-pin panel labels this map "The campus pin AND THE POINT
   * ITS ADDRESS PLACES IT AT", and asks the reader to choose between "Correct
   * the pin" and "Clear the review flag" — a decision its own comment says you
   * make by LOOKING. Until this marker existed only the pin was drawn, framed
   * at zoom 16, so for the campus that actually needed reviewing the second
   * point was several kilometres off-screen. The caption promised two points
   * and the picture showed one, on the one screen whose whole job is comparing
   * them.
   *
   * ⚠️ NOT DRAGGABLE, NOT A TAB STOP, AND NOT CLICKABLE. The anchor is not a
   * thing anybody may move: it is where the address was geocoded to. Making it
   * interactive would invite exactly the gesture that must never be possible.
   */
  private anchorMarker: LeafletNs.Marker | null = null;

  private zoomControl: LeafletNs.Control.Zoom | null = null;
  private sizeWatcher: ResizeObserver | null = null;

  /** At least one tile has painted. Decides whether a tile error is worth saying. */
  private tilePainted = false;

  /** The component is gone; an await that lands after this must do nothing. */
  private gone = false;

  /**
   * The anchor we last put the pin at ourselves.
   *
   * ⚠️ This is how "nobody has touched the pin" is known. See `seedFromAnchor`.
   */
  private lastSeededAnchor: UiMapPoint | null = null;

  /** Who decided where the pin is. See `syncFromInputs`. */
  private pinSource: 'none' | 'inputs' | 'seed' | 'user' = 'none';

  /** The pin/anchor pair the read view was last fitted to. See `syncAnchorMarker`. */
  private framed: string | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.teardown());

    /*
      🔴 `afterNextRender`, AND THAT IS THE WHOLE SSR STORY.

      It runs on browser platforms only — Angular's own guarantee, and the
      pattern its docs show for initialising a non-Angular library against a
      viewChild element. So on a server there is no Leaflet import, no
      `window`, no `ResizeObserver` and no map: the component renders its
      label, its hint and an empty, correctly-sized box, and nothing explodes.

      None of the four apps server-renders today. This costs nothing to be
      right about, and the day one of them does, the failure would otherwise be
      a 500 on a registration page.
    */
    afterNextRender(() => void this.boot());

    /*
      THE INPUT → MARKER PATH. One effect, and the only place an input is
      allowed to move the pin. See THE EMIT LOOP note on the class.
    */
    effect(() => this.syncFromInputs());

    /*
      `readonly` can flip at runtime — the admin's read view has a "correct
      this" button beside it — so interactivity is reconciled rather than
      decided once at construction. Reads `ready()` so that it also runs as
      soon as the map exists.
    */
    effect(() => {
      const interactive = !this.readonly();

      if (this.ready()) {
        this.zone.runOutsideAngular(() => this.applyInteractivity(interactive));
      }
    });

    /*
      THE ANCHOR → MARKER PATH.

      ⚠️ DECLARED AFTER the pin effect on purpose. Effects run in declaration
      order on the first pass, and `showPin` recentres at zoom 16 when a pin
      first appears — so framing both points has to happen second or it is
      immediately overridden by the pin's own setView.
    */
    effect(() => {
      const anchor = this.anchor();
      const pin = this.pin();
      const readonly = this.readonly();

      if (this.ready()) {
        this.zone.runOutsideAngular(() => this.syncAnchorMarker(anchor, pin, readonly));
      }
    });
  }

  /**
   * Put the pin back on the address.
   *
   * ⚠️ It emits unconditionally, even when the pin is already there. The click
   * was a decision, and a host that had drifted out of step with us gets told.
   */
  protected resetToAnchor(): void {
    const anchor = this.anchor();

    if (anchor === null || this.readonly()) {
      return;
    }

    /*
      ⚠️ `'seed'`, NOT `'user'`, and `lastSeededAnchor` is updated with it: the
      pin is now exactly the address point again, which is the state that lets
      a LATER change of address move the pin along with it (see
      `seedFromAnchor`). Calling a reset "user-placed" would freeze the pin at
      an address the school has since corrected.
    */
    this.lastSeededAnchor = anchor;
    this.commit(anchor, 'seed');
  }

  // ===========================================================================
  // THE PIN
  // ===========================================================================

  /**
   * Reconcile the pin with the inputs. The ONLY input-driven mover of the pin.
   *
   * ⚠️ `untracked` on the two reads of our own state. Without it, writing
   * `pin` would re-run this effect to tell it what it just did.
   */
  private syncFromInputs(): void {
    const hostPin = this.hostPin();
    const anchor = this.anchor();
    const current = untracked(() => this.pin());

    /*
      1. THE HOST'S OWN COORDINATES WIN WHILE THEY EXIST — including over a pin
         the user just dragged, if the host declined to store it. The map shows
         the host's state; it does not hold an opinion of its own.
    */
    if (hostPin !== null) {
      if (!samePoint(hostPin, current)) {
        this.pin.set(hostPin);
        this.showPin(hostPin, current === null);
      }

      this.pinSource = 'inputs';

      /*
        ⚠️ THE ADDRESS MOVED AND NOBODY EVER TOUCHED THE PIN. A school that
        corrects its address after we seeded the pin from the old one would
        otherwise keep a pin on the wrong town — mistake-proofing that quietly
        stops working the moment anybody edits anything.

        The guard is narrow on purpose: the stored pin must still be exactly
        the anchor we seeded. If the user has moved the pin by so much as a
        building, it is theirs and we never touch it again.
      */
      if (anchor !== null
        && this.lastSeededAnchor !== null
        && samePoint(hostPin, this.lastSeededAnchor)
        && !samePoint(anchor, this.lastSeededAnchor)) {
        this.seedFromAnchor(anchor);
      }

      return;
    }

    /*
      2. NO HOST COORDINATES. A pin the user placed stays where they put it:
         plenty of hosts will listen to `(picked)` without binding the inputs
         back, and a pin that vanished on every click would make this control
         unusable in exactly that arrangement.
    */
    if (current !== null && this.pinSource === 'user') {
      return;
    }

    if (anchor !== null) {
      if (!samePoint(anchor, this.lastSeededAnchor)) {
        this.seedFromAnchor(anchor);
      }

      return;
    }

    /*
      3. NOTHING AT ALL: centre on India, show no pin. Clearing is only right
         when the pin came FROM the inputs or from us — the host emptying its
         own fields is an instruction, and our own seed has lost its anchor.
    */
    if (current !== null && this.pinSource !== 'user') {
      this.pin.set(null);
      this.pinSource = 'none';
      this.clearPin();
    }
  }

  /**
   * 🔴 THE SEED, AND THE ONE EMIT THAT IS NOT A GESTURE.
   *
   * "Touching the map is optional" is only true if something puts a pin in the
   * record for a school that never does. This is that something, and it has to
   * emit — a pin the host never hears about is a pin that is not saved.
   *
   * ⚠️ `lastSeededAnchor` is written BEFORE the emit, so the value coming back
   * through `latitude`/`longitude` is recognised as our own seed rather than as
   * a fresh anchor to seed again.
   */
  private seedFromAnchor(anchor: UiMapPoint): void {
    this.lastSeededAnchor = anchor;
    this.commit(anchor, 'seed');
  }

  /**
   * The one place the pin moves and `(picked)` fires. Three gestures and the
   * seed all come through here, so there is one definition of "the pin moved".
   *
   * ⚠️ `zone.run`. Leaflet's handlers are bound outside Angular's zone (see
   * `create`), and the host's `(picked)` listener is ordinary application code
   * that will set form state — it has to run where Angular is watching.
   */
  private commit(point: UiMapPoint, source: 'seed' | 'user'): void {
    this.pinSource = source;

    this.zone.run(() => {
      this.pin.set(point);
      this.showPin(point, source === 'seed');
      this.picked.emit(point);
    });
  }

  /**
   * Move (or create) the marker. `focus` recentres the map: true when the pin
   * has just appeared or been reset, false when the host is nudging it.
   */
  private showPin(point: UiMapPoint, focus: boolean): void {
    const L = this.leaflet;
    const map = this.map;

    // Not booted yet: `create` places the marker from `pin()` when it is.
    if (L === null || map === null) {
      return;
    }

    /*
      🔴 OUTSIDE THE ZONE, EVEN THOUGH THIS IS OFTEN CALLED FROM INSIDE IT.

      zone.js captures the zone at the moment a listener is ADDED, not when it
      fires. The marker binds its drag handlers in `createMarker`, and this
      method is reached from the input effect and from `commit`, both of which
      run inside Angular's zone — so a marker created on that path would bind a
      mousemove-rate listener to the zone and run change detection across the
      whole app for every frame of a drag. Creating it out here is what makes
      the claim in `boot` actually true in every path.
    */
    this.zone.runOutsideAngular(() => {
      const latLng = L.latLng(point.latitude, point.longitude);

      if (this.marker === null) {
        this.marker = this.createMarker(L, map, latLng);
      } else {
        this.marker.setLatLng(latLng);
      }

      if (focus) {
        map.setView(latLng, Math.max(map.getZoom(), PIN_ZOOM));
      } else if (!map.getBounds().contains(latLng)) {
        /*
          ⚠️ FOLLOWED, BUT NOT RECENTRED. A host nudging a latitude box must
          not make the map jump on every keystroke — but a pin nudged clean off
          the visible map is worse than a pan, so the view moves only when the
          pin has actually left it, and without animating.
        */
        map.setView(latLng, map.getZoom(), { animate: false });
      }
    });
  }

  private clearPin(): void {
    this.zone.runOutsideAngular(() => {
      this.marker?.remove();
      this.marker = null;

      this.map?.setView([...INDIA_CENTRE] as [number, number], INDIA_ZOOM);
    });
  }

  /**
   * Draw, move or remove the address point, and frame both on the read view.
   *
   * ----------------------------------------------------------------------------
   * ⚠️ HIDDEN WHEN IT IS THE SAME PLACE AS THE PIN
   * ----------------------------------------------------------------------------
   * Which is the ordinary case: the pin STARTS at the anchor, so on most
   * screens the two are the same point and a second marker underneath the
   * first would be a thing to wonder about rather than information. The status
   * line already says "Pinned at the address you entered", which is the whole
   * message when they agree. `SAME_PLACE_KM` is the same threshold that
   * sentence uses, so the marker and the sentence can never disagree.
   *
   * ----------------------------------------------------------------------------
   * 🔴 FRAMING IS READ-VIEW ONLY, AND THAT IS THE NARROW RULE ON PURPOSE
   * ----------------------------------------------------------------------------
   * On the admin's panel, seeing both is the entire point and nobody is
   * editing. In a form the user owns the viewport: dragging a pin away from
   * the address would otherwise make the map zoom out from under the gesture
   * that is still in progress, which is worse than not framing at all.
   *
   * ⚠️ AND ONCE PER PAIR. `framed` records which two points were last fitted,
   * so a re-render cannot keep re-fitting a map somebody has since panned.
   */
  private syncAnchorMarker(
    anchor: UiMapPoint | null,
    pin: UiMapPoint | null,
    readonly: boolean,
  ): void {
    const L = this.leaflet;
    const map = this.map;

    if (L === null || map === null) {
      return;
    }

    const apart = anchor !== null && pin !== null
      && distanceKm(pin.latitude, pin.longitude, anchor.latitude, anchor.longitude) >= SAME_PLACE_KM;

    /*
      ⚠️ `anchor !== null && !apart` COVERS THE PIN-LESS CASE TOO: an anchor
      with no pin at all is worth drawing on its own, because it is the only
      thing there is to show.
    */
    const show = anchor !== null && (pin === null || apart);

    if (!show) {
      this.anchorMarker?.remove();
      this.anchorMarker = null;
      this.framed = null;

      return;
    }

    const latLng = L.latLng(anchor.latitude, anchor.longitude);

    if (this.anchorMarker === null) {
      this.anchorMarker = L.marker(latLng, {
        draggable: false,
        keyboard: false,
        interactive: false,

        /*
          A HOLLOW DISC, NOT A SECOND PIN. The two must be distinguishable at a
          glance and by shape rather than by colour alone — the reader has to
          tell "where the school says it is" from "where its address is" on a
          printed screenshot and with any form of colour vision.
        */
        icon: L.divIcon({
          className: 'map-pick__anchor',
          html: '<span class="map-pick__anchor-dot"></span>',
          iconSize: [18, 18],

          /* Centred: a disc marks its own middle, unlike a pin's point. */
          iconAnchor: [9, 9],
        }),
      }).addTo(map);
    } else {
      this.anchorMarker.setLatLng(latLng);
    }

    if (!readonly || pin === null) {
      return;
    }

    const key = `${pin.latitude},${pin.longitude}|${anchor!.latitude},${anchor!.longitude}`;

    if (this.framed === key) {
      return;
    }

    this.framed = key;

    map.fitBounds(L.latLngBounds([latLng, L.latLng(pin.latitude, pin.longitude)]), {
      /*
        ⚠️ Padding in pixels, not a zoom cap: at 8 km the two sit near the
        edges, and a marker touching the frame reads as "there may be more off
        this side".
      */
      padding: [36, 36],

      /*
        ⚠️ A CEILING, NOT A FLOOR. Two points a few metres apart would
        otherwise fit to street-furniture zoom, which says "these are far
        apart" with a picture.
      */
      maxZoom: PIN_ZOOM,
      animate: false,
    });
  }

  private createMarker(
    L: Leaflet,
    map: LeafletNs.Map,
    latLng: LeafletNs.LatLng,
  ): LeafletNs.Marker {
    const marker = L.marker(latLng, {
      /*
        ⚠️ `untracked`, because this can be reached from inside the input
        effect: a plain read there would quietly make `readonly` a dependency
        of the pin-syncing effect. Harmless today — syncing is idempotent — but
        an accidental dependency is a thing the next person has to work out.
        `applyInteractivity` is what actually keeps this in step.
      */
      draggable: !untracked(() => this.readonly()),

      /*
        ⚠️ NOT A TAB STOP. Leaflet's marker keyboard support is "tab to it and
        press Enter to fire a click" — and a click on the marker moves nothing.
        See the keyboard note on the class: the honest keyboard path is Reset
        plus the host's number inputs.
      */
      keyboard: false,

      /** Dragging towards the edge pans the map rather than stopping dead. */
      autoPan: true,

      /*
        🔴 A CSS PIN, NOT LEAFLET'S DEFAULT MARKER IMAGE, AND NOT A COSMETIC
        CHOICE. Leaflet's default icon finds `marker-icon.png` by reading the
        URL back out of a stylesheet rule at runtime. Under a hashed,
        content-addressed build served from a federation remote on another
        origin, that detection resolves to a file name that does not exist, and
        the symptom is a map with no visible pin — broken in production and
        working locally. A <div> icon has no image to find: it cannot 404, it
        costs no request, and it takes the design system's own colours so the
        pin is the product's primary rather than Leaflet's blue.
      */
      icon: L.divIcon({
        className: 'map-pick__pin',
        html: '<span class="map-pick__pin-head"></span>',
        iconSize: [22, 30],

        /*
          ⚠️ The POINT of the pin, not its middle, is what sits on the
          coordinate — a pin anchored at its centre is half a pin's height
          wrong, which at zoom 16 is most of a building. 28 is where the
          stylesheet's triangle ends; the two numbers have to agree.
        */
        iconAnchor: [11, 28],
      }),
    });

    marker.on({
      /*
        ⚠️ `dragend`, NOT `drag`. `drag` fires continuously, and emitting on
        every frame would push a form write (and in the hosts, a dirty-state
        flag) sixty times a second for one gesture.
      */
      dragend: () => {
        const moved = marker.getLatLng();

        this.commit({ latitude: moved.lat, longitude: moved.lng }, 'user');
      },
    });

    marker.addTo(map);

    /*
      ⚠️ `aria-hidden`, and it is not a cop-out. A <div> pin has no accessible
      name to give, and "image" announced at an unreadable position tells a
      screen-reader user nothing. The status line below the map is where the
      pin's position is actually described, in a sentence.
    */
    marker.getElement()?.setAttribute('aria-hidden', 'true');

    return marker;
  }

  // ===========================================================================
  // THE MAP
  // ===========================================================================

  private async boot(): Promise<void> {
    const L = await loadLeaflet();

    // Destroyed while the chunk was in flight — a dialog closed, a route left.
    if (this.gone) {
      return;
    }

    if (L === null) {
      this.mapUnavailable.set(true);

      return;
    }

    this.leaflet = L;

    /*
      🔴 OUTSIDE ANGULAR'S ZONE, AND THIS MATTERS MORE HERE THAN ALMOST
      ANYWHERE. Leaflet binds mousemove/touchmove/wheel listeners and fires
      them for every frame of a drag. Inside the zone, each one would schedule
      change detection across the whole host app — a shell, a sidebar, a
      50-row table — for a gesture that changes nothing until it ends. The
      three places something actually changes hop back in with `zone.run`
      (see `commit`).
    */
    this.zone.runOutsideAngular(() => this.create(L));
  }

  private create(L: Leaflet): void {
    const host = this.canvas().nativeElement;
    const start = untracked(() => this.pin()) ?? untracked(() => this.anchor());
    const calm = prefersReducedMotion();

    const map = L.map(host, {
      center: start === null
        ? ([...INDIA_CENTRE] as [number, number])
        : [start.latitude, start.longitude],
      zoom: start === null ? INDIA_ZOOM : PIN_ZOOM,

      /*
        ⚠️ ADDED BY `applyInteractivity`, not here, so that the read view has
        no controls at all and a `readonly` that flips can grow them.
      */
      zoomControl: false,

      /* 🔴 THE ATTRIBUTION CONTROL IS THE LICENCE. Never turn this off. */
      attributionControl: true,

      /*
        🔴 THE WHEEL SCROLLS THE PAGE. NEVER ZOOMS THE MAP.

        This map lives in the middle of a long registration form. A wheel that
        zoomed would mean a user scrolling down the page stops dead over the
        map and silently changes it instead — on a laptop that is the single
        most reported complaint about embedded maps. Zooming is the + and −
        buttons, and a pinch on a touch screen, both of which are deliberate.

        ⚠️ The handler is never enabled, so it is set here rather than in
        `applyInteractivity` where a future hand might flip it with the others.
      */
      scrollWheelZoom: false,

      // See `prefersReducedMotion`: asked of Leaflet, not of the stylesheet.
      zoomAnimation: !calm,
      fadeAnimation: !calm,
      markerZoomAnimation: !calm,

      // Decided per `readonly` immediately below.
      dragging: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    const tiles = L.tileLayer(this.provider.urlTemplate, {
      attribution: this.provider.attributionHtml,
      maxZoom: this.provider.maxZoom,
      subdomains: this.provider.subdomains ?? 'abc',
      tileSize: this.provider.tileSize ?? 256,
      zoomOffset: this.provider.zoomOffset ?? 0,
    });

    tiles.on({
      tileload: () => {
        this.tilePainted = true;
      },

      /*
        ⚠️ ONE FAILED TILE IS NOT A FAILED MAP — a single 404 at the edge of a
        zoom level is normal. The note only appears if NOTHING has ever
        painted, which is what a blocked tile host, a captive portal or an
        offline school actually looks like. And it is a note, not an error: the
        coordinates are still typed, saved and valid without a single tile.
      */
      tileerror: () => {
        if (!this.tilePainted && !this.mapUnavailable()) {
          this.zone.run(() => this.mapUnavailable.set(true));
        }
      },
    });

    tiles.addTo(map);

    map.on({
      click: (event: LeafletNs.LeafletMouseEvent) => {
        /*
          ⚠️ GUARDED RATHER THAN UNBOUND. Leaflet keeps firing `click` with
          every interaction handler disabled, so a read view with a live click
          listener would quietly move the admin's pin.
        */
        if (this.readonly()) {
          return;
        }

        this.commit({ latitude: event.latlng.lat, longitude: event.latlng.lng }, 'user');
      },
    });

    this.map = map;

    /*
      The pin may already exist — the seed runs in an effect during change
      detection, which is long before the first render this method follows.
    */
    const pin = untracked(() => this.pin());

    if (pin !== null) {
      this.showPin(pin, true);
    }

    this.watchSize(host, map);

    this.zone.run(() => this.ready.set(true));
  }

  /**
   * 🔴 A MAP BUILT IN A BOX WITH NO SIZE PAINTS NOTHING.
   *
   * Leaflet measures its container once, at construction. Three things in this
   * product build this component before it has a size: `<ui-modal>` (the campus
   * dialog), a `<ui-tabs>` panel that is not the open one, and any `@if` that
   * flips in the same tick. All three produce the same bug — a grey box with
   * one tile in the corner — and all three are fixed by the same call.
   *
   * ⚠️ ResizeObserver fires once on `observe()`, so this covers the initial
   * measurement too, and `heightPx` changing, and the 1440 → 375 reflow.
   */
  private watchSize(host: HTMLElement, map: LeafletNs.Map): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const watcher = new ResizeObserver(() => map.invalidateSize({ animate: false }));

    watcher.observe(host);
    this.sizeWatcher = watcher;
  }

  /**
   * Turn interaction on or off without rebuilding the map.
   *
   * ⚠️ `scrollWheelZoom` is NOT in this list, on purpose. See `create`.
   */
  private applyInteractivity(interactive: boolean): void {
    const L = this.leaflet;
    const map = this.map;

    if (L === null || map === null) {
      return;
    }

    const handlers: readonly (LeafletNs.Handler | undefined)[] = [
      map.dragging,
      map.doubleClickZoom,
      map.touchZoom,
      map.boxZoom,
      map.keyboard,

      // Mobile-only, so it may genuinely not be there.
      map.tapHold,
    ];

    for (const handler of handlers) {
      if (interactive) {
        handler?.enable();
      } else {
        handler?.disable();
      }
    }

    if (interactive && this.zoomControl === null) {
      this.zoomControl = L.control.zoom({ position: 'topleft' });
      this.zoomControl.addTo(map);
    } else if (!interactive && this.zoomControl !== null) {
      this.zoomControl.remove();
      this.zoomControl = null;
    }

    /*
      ⚠️ THE TAB STOP HAS TO BE REMOVED BY HAND. Leaflet's keyboard handler
      adds `tabindex="0"` to the container when it is enabled and does not take
      it away again when it is disabled — leaving a read view with a focusable
      box where every key does nothing.
    */
    if (interactive) {
      map.getContainer().tabIndex = 0;
    } else {
      map.getContainer().removeAttribute('tabindex');
    }

    const dragging = this.marker?.dragging;

    if (dragging !== undefined) {
      if (interactive) {
        dragging.enable();
      } else {
        dragging.disable();
      }
    }
  }

  private teardown(): void {
    this.gone = true;

    this.sizeWatcher?.disconnect();
    this.sizeWatcher = null;

    /*
      ⚠️ `map.remove()` IS NOT OPTIONAL. It is what unbinds Leaflet's document
      and window listeners; without it a school that opens the campus dialog
      five times leaks five maps' worth of handlers into the page.
    */
    this.marker = null;
    this.anchorMarker = null;
    this.framed = null;
    this.zoomControl = null;
    this.map?.remove();
    this.map = null;
    this.leaflet = null;
  }
}
