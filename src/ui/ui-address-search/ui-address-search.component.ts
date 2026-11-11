import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import {
  ADDRESS_SEARCH_DEBOUNCE_MS,
  ADDRESS_SEARCH_MIN_LENGTH,
  AddressLookupService,
  AddressSuggestion,
  ResolvedAddress,
} from '../../core/services/address-lookup.service';

/** Unique ids per instance, so label / listbox / option wiring cannot collide. */
let nextControlId = 0;

/**
 * "Search for your address" — a free-text box that offers suggestions and,
 * when one is picked, hands the caller an address in OUR shape.
 *
 * ----------------------------------------------------------------------------
 * 🔴 IT IS AN ADDITION TO THE MANUAL CASCADE, NEVER A REPLACEMENT
 * ----------------------------------------------------------------------------
 * The State/District/Town/Tehsil dropdowns below it stay exactly as they are,
 * keep working on their own, and remain the only path that is required. This
 * control fills them in faster when it can, and when it cannot it gets out of
 * the way — down to not rendering at all.
 *
 * It is NOT a form field. It carries no value anybody submits, it is bound to
 * no form control, nothing validates it, and nothing about pressing Continue or
 * Save depends on it. Everything it produces is written into the host form's
 * OWN fields through `resolved`.
 *
 * ----------------------------------------------------------------------------
 * 🔴 EVERY REFUSAL IS SILENT
 * ----------------------------------------------------------------------------
 * A 429 from the per-IP limiter, a provider timeout, a 500, a dropped
 * connection, an empty result: the list simply does not open. No toast, no
 * banner, no red text, nothing disabled. AddressLookupService maps all of them
 * to an empty list for exactly this reason — see the long note there about why
 * it bypasses errorInterceptor, which would otherwise raise "Too many
 * attempts…" over a half-filled registration form.
 *
 * ⚠️ THE 429 IS THE ONE THAT MATTERS MOST. The limiter is 30 requests a minute
 * per IP (PublicRateLimiting.AddressLookupPerIp), and a school typing from
 * behind an office NAT can reach it honestly. They are mid-registration, so a
 * rate limit has to look like "no suggestions for that", not like a broken
 * form. It also heals itself: the next debounced query after the window rolls
 * over is answered normally, and a refused request costs the client's paid
 * quota nothing, because the server never calls out.
 *
 * ----------------------------------------------------------------------------
 * 🔴 WHY IT IS NOT <ui-combobox>, WHICH IT OTHERWISE LOOKS LIKE
 * ----------------------------------------------------------------------------
 * `<ui-combobox>` is a SELECT: a fixed option set, a value that is always one
 * of the options or null, and filtering done in the browser over a master it
 * already holds. This is free text whose suggestions come from a paid remote
 * call, which commits nothing, and whose "options" change on every keystroke.
 * Bending one into the other would push a debounce, a quota and a
 * null-resolve path into a control that forty dropdowns across four apps
 * depend on.
 *
 * ⚠️ THE ARIA PATTERN IS COPIED FROM IT DELIBERATELY, and jp-shared is not
 * touched: `role="combobox"` on the input that takes focus (not on a wrapper),
 * `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`,
 * `aria-activedescendant` naming the active option's id, and a `role="listbox"`
 * whose only children are `role="option"`. That last one is why the empty case
 * renders NO list rather than a "nothing found" row: `aria-required-children`
 * allows only options inside a listbox — and an empty search has nothing to
 * say anyway.
 *
 * ⚠️ `autocomplete="off"` AND A NON-ADDRESSY id. Browsers autofill anything
 * that smells like an address field, and the browser's own dropdown lands on
 * top of this one — two lists over one box, with the arrow keys driving
 * whichever the browser decided owns them.
 *
 * ----------------------------------------------------------------------------
 * ⚠️ THE OPEN LIST IS ABSOLUTE, NOT PINNED TO THE VIEWPORT
 * ----------------------------------------------------------------------------
 * `<ui-combobox>` measures the viewport and paints its list `position: fixed`,
 * because inside `<ui-modal>` — whose body is `overflow-y: auto` — an absolute
 * list extends the dialog's scroll height instead of floating over it.
 *
 * This control sits at the TOP of both forms that use it, where a 15rem list is
 * within the dialog's visible area, so it carries none of that measurement
 * code. 🔴 IF IT IS EVER MOVED LOW IN A SCROLLING DIALOG the bottom of its list
 * becomes reachable only by scrolling that dialog, and the fix is `measure()`
 * in ui-combobox.component.ts — copy it, do not rediscover it.
 */
@Component({
  selector: 'ui-address-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-address-search.component.html',
  styleUrl: './ui-address-search.component.scss',

  /*
    🔴 THE HOST ELEMENT EXISTS EVEN WHEN NOTHING RENDERS, so a caller that
    needs to space this control has to be able to tell the two states apart.

    `<app-address-search>` is written in the caller's template, so it is in the
    DOM whatever `available()` says — only its CONTENTS are conditional. A
    caller's `app-address-search { margin-bottom: … }` would therefore leave a
    1rem hole above the Address field on every deployment where the provider is
    off, which is TODAY's deployment and exactly the "the form is unchanged"
    promise this feature makes.

    ⚠️ A CLASS AND NOT `:empty`. `:empty` would match — a browser ignores the
    comment anchor `@if` leaves behind — but it is a rule nobody reading the
    stylesheet would predict, and it would silently stop working the day
    anything unconditional is added to this template.
  */
  host: {
    '[class.addr-search--active]': 'available()',
  },
})
export class UiAddressSearchComponent {
  private readonly lookup = inject(AddressLookupService);

  /**
   * ⚠️ Needed because `choose()` is not an injection context: a `resolve` in
   * flight when the campus dialog is destroyed must be dropped, not delivered
   * into a component that is gone.
   */
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The visible label.
   *
   * ⚠️ A REAL `<label for>`, not a placeholder. A field whose name lives only
   * in its placeholder loses that name the moment somebody types in it.
   */
  readonly label = input('Search for your address');

  /**
   * An address the user picked, in our shape.
   *
   * 🔴 THE HOST FILLS ITS OWN FORM. This control knows nothing about draft
   * fields, reactive form controls, or which master feeds which dropdown — and
   * it must not, because the two forms using it store a different subset of the
   * same address. See `onAddressResolved` in registration.component.ts and in
   * branches.component.ts.
   */
  readonly resolved = output<ResolvedAddress>();

  /**
   * 🔴 FALSE UNTIL THE SERVER SAYS OTHERWISE, AND FALSE FOR GOOD IF IT SAYS NO.
   *
   * Nothing renders while this is false — not a disabled box, not a box that
   * returns nothing, not an explanation of a feature nobody asked for. The form
   * is then exactly what it was before this control existed, which is TODAY's
   * shipped state: AddressLookupOptions.Provider defaults to `None`.
   */
  protected readonly available = signal(false);

  protected readonly query = signal('');
  protected readonly suggestions = signal<readonly AddressSuggestion[]>([]);
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);

  /** A suggest call is in flight. ⚠️ Never an error state — just "waiting". */
  protected readonly searching = signal(false);

  /** A resolve call is in flight, between the pick and the cascade filling in. */
  protected readonly resolving = signal(false);

  /**
   * ⚠️ Tracked so a response that arrives AFTER the user has left the box
   * cannot reopen the list under a cursor that has moved on. A debounced
   * request outlives focus.
   */
  private readonly focused = signal(false);

  /** Levels the provider named that our masters do not contain. */
  private readonly unmatched = signal<readonly string[]>([]);

  /** The provider's own one-line rendering of the address just filled in. */
  private readonly filledFrom = signal<string | null>(null);

  /** Keystrokes, before the debounce. */
  private readonly typed = new Subject<string>();

  protected readonly controlId = `address-search-${++nextControlId}`;
  protected readonly listId = `${this.controlId}-list`;
  protected readonly statusId = `${this.controlId}-status`;

  /**
   * 🔴 THE HONEST SENTENCE ABOUT WHAT WE COULD NOT MATCH.
   *
   * The server sends strings like `district 'Faridabad Division'`
   * (GooglePlacesAddressLookupService.ToResolvedAsync), so this adds "the" and
   * joins them.
   *
   * ⚠️ IT NAMES NO PARTICULAR CONTROL. "Please pick it below" would point at a
   * box that may not exist: the campus form has no tehsil question at all, and
   * a district control is hidden whenever its list is empty. "Check the boxes
   * below" is true on both forms in every one of those states.
   */
  protected readonly unmatchedNote = computed(() => {
    const parts = this.unmatched().map((level) => `the ${level}`);

    if (parts.length === 0) {
      return null;
    }

    const list = parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

    return `We could not find ${list} in our lists, so that part has been left empty. `
      + 'Check the boxes below and pick what you can.';
  });

  /** The quiet confirmation, for when everything matched. */
  private readonly filledNote = computed(() => {
    const from = this.filledFrom();

    return from === null
      ? null
      : `Filled in from ${from}. Check it below and change anything we got wrong.`;
  });

  /**
   * What the status line says, or null for nothing.
   *
   * ⚠️ ONE REGION, TWO MESSAGES, NEVER BOTH AT ONCE. An unmatched level is the
   * more important of the two, so it wins — and `aria-live="polite"` is why a
   * screen-reader user hears that the cascade below them has just changed
   * without the focus being moved for them.
   */
  protected readonly status = computed(() => this.unmatchedNote() ?? this.filledNote());

  protected readonly hasUnmatched = computed(() => this.unmatchedNote() !== null);

  constructor() {
    /*
      🔴 ASKED ONCE, AND IT DECIDES WHETHER ANYTHING RENDERS AT ALL.

      Cached in the service, so the registration form and the campus dialog
      share one request per session. A failure answers false — the manual
      cascade is a first-class path, so "we could not find out" degrading to
      "do not offer it" costs the user nothing.
    */
    this.lookup
      .isAvailable()
      .pipe(takeUntilDestroyed())
      .subscribe((available) => this.available.set(available));

    /*
      ==========================================================================
      🔴 THE DEBOUNCE IS A SPENDING CONTROL, NOT A PERFORMANCE TWEAK
      ==========================================================================
      Every suggest call that reaches the provider is billed to the client.
      Firing on each keystroke would turn "Sector 14, Gurugram" into eighteen
      paid lookups for one address, seventeen of which nobody read.

      So, in this order:

        debounceTime(300)       one request per pause, not one per key
        trim()                  a trailing space is not a new question
        distinctUntilChanged()  retyping the same text asks nothing new — this
                                is what makes backspace-and-retype free
        length >= 3             two letters match half of India

      ⚠️ THE SERVER ENFORCES THE MINIMUM TOO. This copy is not the rule; it is
      this client declining to spend the client's money from a keyboard.

      ⚠️ switchMap, NOT mergeMap. A slow answer to "Rohta" must never land on
      top of the answer to "Rohtak" — the person would be offered suggestions
      for a question they had already finished changing.

      ⚠️ NOTHING HERE TOUCHES THE TEXT BEYOND trim(). No case folding, no
      stripping of anything "unexpected": "रोहतक" has to reach the provider and
      come back intact, and sanitising a search term is how a Hindi locality
      becomes unsearchable.
    */
    this.typed
      .pipe(
        debounceTime(ADDRESS_SEARCH_DEBOUNCE_MS),
        map((raw) => raw.trim()),
        distinctUntilChanged(),
        tap((text) => this.searching.set(text.length >= ADDRESS_SEARCH_MIN_LENGTH)),
        switchMap((text) => (text.length >= ADDRESS_SEARCH_MIN_LENGTH
          ? this.lookup.suggest(text)
          : of<AddressSuggestion[]>([]))),
        takeUntilDestroyed(),
      )
      .subscribe((items) => {
        this.searching.set(false);
        this.suggestions.set(items);

        /*
          🔴 AN EMPTY LIST IS NOT AN ERROR AND IS NEVER ANNOUNCED. A refused, a
          timed-out and an honestly-empty search are one event here: the list
          does not open, and the dropdowns below carry on working.
        */
        this.open.set(this.focused() && items.length > 0);
        this.activeIndex.set(items.length > 0 ? 0 : -1);
      });
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;

    this.query.set(text);

    /*
      ⚠️ THE NOTES FROM THE LAST PICK GO THE MOMENT THE TEXT CHANGES. Both are
      statements about an address that is no longer the one in the box, and a
      stale "we could not find the district…" is worse than no note: it reports
      a problem with something the user has already moved on from.
    */
    this.unmatched.set([]);
    this.filledFrom.set(null);

    this.typed.next(text);
  }

  protected onFocus(): void {
    this.focused.set(true);

    // Reopened only when there is something to show — never an empty box's
    // empty list.
    if (this.suggestions().length > 0) {
      this.open.set(true);
    }
  }

  /**
   * ⚠️ THE TYPED TEXT SURVIVES A BLUR. It is the user's own words about where
   * they are, and this control commits nothing — there is no "selection" for it
   * to snap back to, the way `<ui-combobox>` has. Only the list closes.
   */
  protected onBlur(): void {
    this.focused.set(false);
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  /**
   * One suggestion picked: resolve it, then hand the result to the host.
   *
   * ⚠️ THE BOX IS SET TO WHAT THEY PICKED, so the control reads as the address
   * they chose rather than the fragment they typed. It is NOT pushed back
   * through `typed`, which would spend another paid lookup asking about an
   * address we have just resolved.
   *
   * 🔴 A NULL RESOLVE IS SILENT. The provider going quiet between the
   * suggestion and the pick — a 429, a timeout, an expired place token, and the
   * controller answers all of them as a 200 with no data — leaves the typed
   * text alone, the cascade untouched and nothing said. The dropdowns below
   * were always the way to finish.
   */
  protected choose(suggestion: AddressSuggestion): void {
    this.query.set(suggestion.description);
    this.suggestions.set([]);
    this.open.set(false);
    this.activeIndex.set(-1);
    this.unmatched.set([]);
    this.filledFrom.set(null);
    this.resolving.set(true);

    this.lookup
      .resolve(suggestion.placeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((address) => {
        this.resolving.set(false);

        if (address === null) {
          return;
        }

        this.unmatched.set(address.unmatched ?? []);
        this.filledFrom.set(address.formattedAddress);

        this.resolved.emit(address);
      });
  }

  /**
   * Arrow keys, Enter, Escape.
   *
   * ⚠️ `preventDefault` ONLY WHERE THE KEY IS ACTUALLY BEING USED, the same
   * rule `<ui-combobox>` follows. Swallowing Enter while the list is shut would
   * stop the registration form being advanced from the keyboard; swallowing
   * Escape would stop the campus dialog being closed with it.
   */
  protected onKey(event: KeyboardEvent): void {
    const items = this.suggestions();

    switch (event.key) {
      case 'ArrowDown':
        if (items.length === 0) {
          return;
        }

        event.preventDefault();
        this.open.set(true);
        this.activeIndex.set((this.activeIndex() + 1) % items.length);
        break;

      case 'ArrowUp':
        if (items.length === 0) {
          return;
        }

        event.preventDefault();
        this.open.set(true);
        this.activeIndex.set((this.activeIndex() - 1 + items.length) % items.length);
        break;

      case 'Enter': {
        const active = items[this.activeIndex()];

        if (this.open() && active) {
          event.preventDefault();
          this.choose(active);
        }

        break;
      }

      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.open.set(false);
          this.activeIndex.set(-1);
        }

        break;

      default:
        break;
    }
  }

  protected optionId(index: number): string {
    return `${this.listId}-opt-${index}`;
  }
}
