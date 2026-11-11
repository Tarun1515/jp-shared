import {
  ChangeDetectionStrategy, Component, ElementRef, computed, effect, forwardRef, input, signal,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { UiFormControlBase } from '../ui-form-control.base';
import { UiSelectOption } from '../ui-select/ui-select.component';

/**
 * Where the open list is pinned, in viewport coordinates.
 *
 * `top` and `bottom` are mutually exclusive: the list either hangs below the
 * field or grows upward from above it, and the unused one is null so the style
 * binding removes the property instead of fighting the other one.
 */
interface ComboboxListBox {
  readonly left: number;
  readonly width: number;
  readonly maxHeight: number;
  readonly top: number | null;
  readonly bottom: number | null;
}

/** The gap between field and list — $space-1, as the stylesheet had it. */
const LIST_GAP = 4;

/** 15rem, the cap the stylesheet used while the list was absolute. */
const LIST_MAX = 240;

/** 12rem on a phone, where the on-screen keyboard takes the rest. */
const LIST_MAX_SMALL = 192;

/** 36rem, the stylesheet's phone breakpoint, in pixels. */
const SMALL_VIEWPORT = 576;

/** The list never sits flush against the edge of the viewport. */
const VIEWPORT_MARGIN = 8;

/** Below this much room underneath, opening downward is not worth it. */
const FLIP_BELOW = 120;

/** Two rows and a scrollbar: a cramped viewport gets a short list, not none. */
const LIST_MIN = 80;

/**
 * A searchable single-select — one component, used everywhere a master feeds
 * a dropdown.
 *
 * ----------------------------------------------------------------------------
 * 🔴 WHY THIS EXISTS, AND WHY IT IS NOT A SECOND SELECT
 * ----------------------------------------------------------------------------
 * SR-1 seeded 143 Haryana towns, and will seed every other state's in time. A
 * native `<select>` with 143 options is a list somebody scrolls, and the only
 * way to reach "Nathusari Chopta" is to know roughly where N falls. Subject
 * and qualification lists have the same problem at smaller scale.
 *
 * ⚠️ IT TAKES THE SAME `UiSelectOption[]` AS `<ui-select>`, deliberately. A
 * drop-in swap is a tag change, which is what makes "replace every plain
 * select over master data" a change somebody can actually finish — and G27 is
 * the standing instruction that there is ONE such component, not one per app.
 *
 * ----------------------------------------------------------------------------
 * ⚠️ WHAT IT IS NOT
 * ----------------------------------------------------------------------------
 * It is not free text. The value committed is always an option's `value`, or
 * null. Somebody typing a town we do not have gets nothing selected — which is
 * correct, and is why SR-1's address form keeps a free-text
 * `AreaOrVillage` beside it rather than letting this invent a row.
 *
 * ----------------------------------------------------------------------------
 * 🔴 THERE IS A SECOND SEARCHABLE SELECT, AND IT IS DECLARED
 * ----------------------------------------------------------------------------
 *     twin:  jp-public/src/app/ui/combobox/public-combobox.component.ts
 *
 * G27 says there is ONE of these. jp-public has its own, deliberately: it is
 * UNFEDERATED by decision 2.43 — no jp-shared tsconfig path, no federation
 * config, not a line of shared JavaScript — so it cannot import this one, and
 * 902 towns in a native dropdown on the most public page the product has could
 * not wait for that decision to be reversed. It is progressive enhancement
 * there: the server sends a real <select> with its options and the type-ahead
 * replaces it after hydration, which this component has no SSR to need.
 *
 * 🔴 PARITY IS ASSERTED, NOT TRUSTED. The filtering and ranking rule both
 * controls obey is held as DATA in ONE file that BOTH suites run:
 *
 *     jp-docs/scripts/verify/lib/combobox-vectors.mjs
 *
 * combobox-rank.mjs runs it against THIS component in a browser;
 * public-combobox.mjs runs it against jp-public's own combobox-rank.ts. So
 * narrowing `visible()` below turns the PUBLIC SITE's suite red, and a case
 * added to the vectors obliges both sides to answer it.
 *
 * ⚠️ WHAT IS DELIBERATELY DIFFERENT THERE, so it does not read as drift: no
 * `searchFrom` threshold (every public filter upgrades — a control whose
 * keyboard behaviour changes when a master grows is worse than one that always
 * behaves the same way); no ControlValueAccessor (the URL is that page's form);
 * no clear button (the first row of its list is "Any subject"); it paints at
 * most 50 rows and says so underneath; and its open list is ABSOLUTE inside a
 * relative wrapper rather than pinned to the viewport, because the public
 * filter bar has no scrolling ancestor to escape — so it carries none of
 * `measure()`'s correctness burden.
 *
 * ----------------------------------------------------------------------------
 * 🔴 THE OPEN LIST IS PINNED TO THE VIEWPORT, NOT LAID OUT IN THE PAGE
 * ----------------------------------------------------------------------------
 * The list used to be `position: absolute` inside `.cmb`. That is correct right
 * up until an ancestor scrolls — and `ui-modal`'s body is `overflow-y: auto`, so
 * inside a modal the open list EXTENDED THE MODAL'S SCROLL HEIGHT instead of
 * floating over its content. The options were reachable, by scrolling the
 * dialog, which is not what a dropdown is.
 *
 * ⚠️ THE FIX IS HERE AND NOT IN `ui-modal`. Making the modal body
 * `overflow: visible` would not even work — `.modal-backdrop` is
 * `overflow-y: auto` too, so the list would extend THAT scroll area instead —
 * and it would cost every tall modal in four apps its scrollbar, leaving the
 * Save button below the fold with no way to reach it. One control changes its
 * own painting instead; `ui-modal` is untouched.
 *
 * ⚠️ PINNED MEANS MEASURED. `measure()` runs before every open and on every
 * scroll and resize while open. See the constructor for why that listener
 * captures.
 *
 * @example
 * <ui-combobox label="City" [options]="cityOptions()" formControlName="cityId" />
 */
@Component({
  selector: 'ui-combobox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-combobox.component.html',
  styleUrl: './ui-combobox.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiComboboxComponent),
      multi: true,
    },
  ],
})
export class UiComboboxComponent extends UiFormControlBase<string | number> {
  readonly options = input<readonly UiSelectOption[]>([]);

  readonly placeholderOption = input('Type to search…');

  readonly loading = input(false);

  /**
   * How many options before the list is worth searching at all.
   *
   * ⚠️ Below this the component still works — it just opens showing
   * everything, which for six subjects is the whole point. A search box over
   * four options is a worse control than the four options.
   */
  readonly searchFrom = input(8);

  /**
   * The accessible name, for the one case where no visible label is wanted.
   *
   * ----------------------------------------------------------------------------
   * 🔴 WHY THIS EXISTS AND WHEN TO USE IT
   * ----------------------------------------------------------------------------
   * A filter toolbar puts three controls in a row and names them by their
   * placeholder — "All subjects", "Anywhere" — because three stacked labels
   * above three narrow boxes is a worse toolbar. Those screens were written
   * with `<label class="visually-hidden">`, which a plain `<select>` could use
   * through `for`/`id`.
   *
   * ⚠️ THIS COMPONENT OWNS ITS OWN `controlId`, so an outside label cannot
   * point at it. Dropping the label and passing nothing leaves the input with
   * NO ACCESSIBLE NAME — a screen reader announces "combobox" and nothing
   * else. That is a real regression, not a cosmetic one, which is why the
   * toolbar case gets a supported input rather than each caller inventing a
   * workaround.
   *
   * ⚠️ PREFER `label`. This is for toolbars, not for forms. If the control sits
   * in a form, give it a visible label — a form field whose name is only in its
   * placeholder loses that name the moment somebody types.
   *
   * Ignored when `label` is set, since the `<label for>` already names it and
   * two names is worse than one.
   */
  readonly ariaLabel = input<string>();

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(-1);

  /**
   * Where the open list sits on screen, or null before the first measurement.
   *
   * ⚠️ null IS A REAL STATE, and the stylesheet keeps the old absolute
   * placement as its fallback for it. A fixed box with no coordinates lands
   * wherever its static position happened to be, which is nowhere useful.
   */
  protected readonly listBox = signal<ComboboxListBox | null>(null);

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  /** The chosen option, if the current value matches one. */
  protected readonly selected = computed(() =>
    this.options().find((o) => o.value === this.value()) ?? null);

  protected readonly searchable = computed(() => this.options().length >= this.searchFrom());

  /**
   * What the list shows.
   *
   * ⚠️ MATCHES ANYWHERE IN THE LABEL, not just the start. Somebody looking for
   * "Nathusari Chopta" may well type "chopta", and a prefix match would show
   * them nothing while the row sits in the list.
   */
  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();

    if (!q) {
      return this.options();
    }

    /*
      🔴 MATCHES ANYWHERE, BUT WHAT STARTS WITH THE QUERY COMES FIRST.

      Substring matching is right and stays — somebody looking for "Nathusari
      Chopta" should find it by typing "chopta". But ranking by nothing at all
      produced this, caught in a walkthrough screenshot: typing **Har** into
      the state box offered

          Bihar · Haryana · Jharkhand · Maharashtra

      in that order, because Bi-HAR comes first alphabetically. The person
      typing "Har" wants Haryana, and the first row is the one they press — so
      the control was actively steering them to the wrong state.

      ⚠️ NOTHING IS FILTERED OUT by this change; only the order moves. A
      narrower filter would have broken the "chopta" case to fix the "Har" one.

      ⚠️ `sort` ON A COPY. `this.options()` is an input array — sorting it in
      place would reorder the caller's own data, and a computed must not do
      that to its source.
    */
    const hits = this.options().filter((o) => o.label.toLowerCase().includes(q));

    return [...hits].sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.label.toLowerCase().startsWith(q) ? 0 : 1;

      return aStarts - bStarts;
    });
  });

  /** What the closed control reads as. */
  protected readonly display = computed(() =>
    this.open() ? this.query() : this.selected()?.label ?? '');

  protected readonly listId = `${this.controlId}-list`;

  protected optionId(index: number): string {
    return `${this.listId}-opt-${index}`;
  }

  constructor() {
    super();

    /*
      🔴 PINNED MEANS RE-PINNED. The list is placed in viewport coordinates,
      so anything that moves the field underneath it has to be answered with a
      fresh measurement or the list simply stays behind: scrolling the modal
      body, scrolling the page, resizing the window, rotating a phone.

      ⚠️ `capture: true` IS LOAD-BEARING. Scroll events do not bubble. The
      scroll that matters here happens on `.modal__body`, several elements
      below the window, and a bubbling listener on window would never hear it.

      Attached only while the list is open, which is the only time a
      measurement is worth taking.
    */
    effect((onCleanup) => {
      if (!this.open()) {
        return;
      }

      const follow = (): void => this.measure();

      window.addEventListener('scroll', follow, true);
      window.addEventListener('resize', follow);

      onCleanup(() => {
        window.removeEventListener('scroll', follow, true);
        window.removeEventListener('resize', follow);
      });
    });
  }

  /**
   * Pins the list to where the field is on screen right now.
   *
   * One `getBoundingClientRect` and one signal write — cheap enough to run on
   * every scroll event while the list is open, and it runs nowhere else.
   */
  private measure(): void {
    const input = this.field()?.nativeElement;

    if (!input) {
      return;
    }

    const rect = input.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const cap = viewportWidth <= SMALL_VIEWPORT ? LIST_MAX_SMALL : LIST_MAX;
    const below = viewportHeight - rect.bottom - LIST_GAP - VIEWPORT_MARGIN;
    const above = rect.top - LIST_GAP - VIEWPORT_MARGIN;

    /*
      Downward unless downward is genuinely cramped AND upward is better.
      "Whichever side has more room" would flip the list for any field in the
      top half of a tall window, which is a jump nobody asked for.
    */
    const flip = below < Math.min(cap, FLIP_BELOW) && above > below;
    const width = Math.min(rect.width, viewportWidth - VIEWPORT_MARGIN * 2);

    this.listBox.set({
      /*
        ⚠️ CLAMPED. Nothing above a fixed box clips it, which is the point —
        and it also means nothing above it will catch a list that runs off the
        right-hand edge of a narrow window. So it is caught here.
      */
      left: Math.min(Math.max(rect.left, VIEWPORT_MARGIN), viewportWidth - width - VIEWPORT_MARGIN),
      width,
      maxHeight: Math.max(LIST_MIN, Math.min(cap, flip ? above : below)),
      top: flip ? null : rect.bottom + LIST_GAP,
      bottom: flip ? viewportHeight - rect.top + LIST_GAP : null,
    });
  }

  protected onFocus(): void {
    this.measure();
    this.open.set(true);
    this.query.set('');

    /*
      ⚠️ THE ACTIVE ROW STARTS ON THE CURRENT VALUE, not at the top. Reopening
      a filled control and pressing Enter must not silently change it to the
      first option in the list.
    */
    this.activeIndex.set(this.visible().findIndex((o) => o.value === this.value()));
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);

    // Re-measured on every keystroke: an error message appearing above the
    // field moves it, and no scroll or resize event is fired when it does.
    this.measure();
    this.open.set(true);
    this.activeIndex.set(this.visible().length ? 0 : -1);
  }

  /**
   * Closing without choosing.
   *
   * 🔴 THE VALUE IS NOT CLEARED HERE. Typing two letters and clicking away
   * must leave the previously chosen option alone — the query is scratch
   * state, not the value. The input is redrawn from `display()`, so it snaps
   * back to the selected label on its own.
   */
  protected onBlur(): void {
    this.open.set(false);
    this.query.set('');
    this.activeIndex.set(-1);
    this.markTouched();
  }

  protected choose(option: UiSelectOption): void {
    if (option.disabled) {
      return;
    }

    this.commit(option.value);
    this.open.set(false);
    this.query.set('');
    this.field()?.nativeElement.blur();
  }

  protected clear(): void {
    this.commit(null);
    this.query.set('');
    this.open.set(false);
  }

  protected onKey(event: KeyboardEvent): void {
    const list = this.visible();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.measure();
        this.open.set(true);
        this.activeIndex.set(list.length ? (this.activeIndex() + 1) % list.length : -1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.measure();
        this.open.set(true);
        this.activeIndex.set(list.length ? (this.activeIndex() - 1 + list.length) % list.length : -1);
        break;

      case 'Enter': {
        /*
          ⚠️ preventDefault ONLY when this control is actually using the key.
          Swallowing Enter unconditionally would stop a one-field form being
          submitted from the keyboard, which is a thing people do.
        */
        const active = list[this.activeIndex()];

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
          this.query.set('');
        }

        break;

      default:
        break;
    }
  }
}
