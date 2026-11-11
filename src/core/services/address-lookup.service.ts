import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { JP_API_CONFIG } from '../app-identity';
import { SKIP_ERROR_TOAST } from '../interceptors/error.interceptor';
import { SKIP_LOADER } from '../interceptors/loader.interceptor';
import { ApiResponse } from '../models/api-response.model';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';

/**
 * One suggestion while somebody is typing an address.
 *
 * Mirrors JP.Domain.Address.AddressSuggestion. Deliberately thin: a label and
 * an opaque token to fetch the real thing with. NOTHING is stored from it, and
 * nothing in this app may depend on its shape beyond these four fields — the
 * provider owns it, and the whole point of the server-side seam is that the
 * provider's vocabulary stops at the API.
 */
export interface AddressSuggestion {
  description: string;
  placeId: string;
  mainText: string | null;
  secondaryText: string | null;
}

/**
 * An address resolved into OUR shape. Mirrors JP.Domain.Address.ResolvedAddress.
 *
 * 🔴 THESE ARE THE SAME FIELDS THE MANUAL CASCADE PRODUCES, AND THAT IS THE
 * POINT. Ids from our own masters plus free text, plus the coordinates and the
 * place id. A row entered through the search box and a row entered through the
 * dropdowns are indistinguishable once stored, so no read written afterwards
 * has to know which path produced it.
 *
 * ⚠️ EVERY ID IS NULLABLE, INCLUDING THE STATE. A provider can answer with a
 * place in a state we have not seeded; that is a real answer, not an error.
 * What could not be matched is named in `unmatched` so the form can say so out
 * loud instead of quietly handing back a shorter address.
 */
export interface ResolvedAddress {
  stateId: number | null;
  districtId: number | null;
  tehsilId: number | null;
  cityId: number | null;
  areaOrVillage: string | null;
  addressLine1: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  formattedAddress: string | null;

  /**
   * What the provider named that our masters do not contain, as
   * `district 'Faridabad Division'`.
   *
   * 🔴 SHOWN TO THE USER, NEVER SWALLOWED. The server writes these strings
   * (GooglePlacesAddressLookupService.ToResolvedAsync); the control renders
   * them. Dropping one produces an address that looks complete and has lost a
   * level.
   */
  unmatched: string[];
}

/**
 * The shortest query worth sending.
 *
 * 🔴 THE SERVER ENFORCES THIS TOO. The client's copy is not the rule — it is
 * about not spending the client's PAID QUOTA from a keyboard. Two letters match
 * half of India, so a request for them costs money and tells nobody anything.
 */
export const ADDRESS_SEARCH_MIN_LENGTH = 3;

/** How long a key has to be still before the query goes out. */
export const ADDRESS_SEARCH_DEBOUNCE_MS = 300;

/**
 * The client half of the address-lookup seam.
 *
 * ----------------------------------------------------------------------------
 * 🔴 THERE IS NO GOOGLE IN THIS FILE, AND THERE MUST NEVER BE
 * ----------------------------------------------------------------------------
 * The browser calls OUR three endpoints and nothing else. No Places SDK, no
 * script tag, no `maps.googleapis.com`, and above all NO API KEY — the key
 * lives in one environment variable read by the API
 * (AddressLookupOptions.ApiKeyEnvironmentVariable) and never leaves the server.
 * A key in a frontend bundle is a key the whole internet can spend.
 *
 * If a future change here wants a key, the change has misunderstood the design.
 *
 * ----------------------------------------------------------------------------
 * 🔴 EVERY METHOD ANSWERS. NONE OF THEM THROWS.
 * ----------------------------------------------------------------------------
 * `isAvailable` resolves to false, `suggest` to an empty list, `resolve` to
 * null. A 429 from the per-IP limiter, a provider timeout, a 500, a dropped
 * connection and an honestly empty result are all the SAME answer to a caller:
 * "no suggestions". Somebody is mid-registration; a third party having a bad
 * minute must cost them nothing but the box they were not obliged to use.
 *
 * ⚠️ That is the same convention `loadDistricts` / `loadTehsilsForCity` already
 * follow in the registration form, where an empty list and a failed call
 * deliberately look identical to the form.
 *
 * ----------------------------------------------------------------------------
 * 🔴 ONE COPY, IN jp-shared — AND IT WAS TWO FOR AN AFTERNOON
 * ----------------------------------------------------------------------------
 * The school side and the teacher side both need this, and both were written
 * at once, in parallel, in their own repositories. That produced two mirrors
 * of the same server contract — exactly what G27 forbids, and with no
 * federation boundary to justify it the way jp-public's combobox has. They are
 * merged here; the apps import this one.
 *
 * ----------------------------------------------------------------------------
 * ⚠️ THE CALLS ARE QUIET BY CONTEXT TOKEN, NOT BY ESCAPING THE INTERCEPTORS
 * ----------------------------------------------------------------------------
 * These three calls must fail silently: a 429 from the quota limiter, a
 * timeout, a provider that refuses — every one of them means "no suggestions",
 * and the form carries on with its dropdowns. The default chain is wrong for
 * that in two ways, and right in a third:
 *
 *   · errorInterceptor TOASTS. "Too many attempts. Please wait a moment and
 *     try again." over a form somebody is halfway through filling in, about a
 *     control they did not ask for. `SKIP_ERROR_TOAST` declines it per request.
 *   · loaderInterceptor would black the screen out on a debounced keystroke.
 *     `SKIP_LOADER` already existed for exactly this.
 *   · authInterceptor is KEPT. /api/address is [AllowAnonymous] because
 *     registration is anonymous — but when a token IS present the API's
 *     per-session cap keys on the user rather than the IP, so a staff room
 *     behind one NAT is not rate-limited by a colleague's typing. Sending the
 *     token buys that, and costs nothing when there is none.
 *
 * ⚠️ BOTH APPS FIRST SOLVED THIS WITH `new HttpClient(inject(HttpBackend))`,
 * independently, because there was no way to decline the toast alone. That
 * bypass also drops the auth interceptor and every header the chain grows
 * later, and each copy had to re-attach the bearer by hand. The token is the
 * fix; the bypass was the symptom.
 */
@Injectable({ providedIn: 'root' })
export class AddressLookupService {
  private readonly api = inject(JP_API_CONFIG);

  private readonly http = inject(HttpClient);

  /** Quiet and loaderless — see the class remark. */
  private get quiet(): { context: HttpContext } {
    return {
      context: new HttpContext().set(SKIP_LOADER, true).set(SKIP_ERROR_TOAST, true),
    };
  }

  private readonly baseUrl = `${this.api.appApiUrl}/address`;

  /**
   * Asked once per session and shared by every form that wants to know.
   *
   * ⚠️ NOT EVICTED ON FAILURE, unlike MasterService's cache. A failed
   * availability check and a provider that is switched off have the same
   * consequence — no search box — and re-asking per form would add a request
   * per screen to learn the same nothing. The manual cascade is a first-class
   * path, so "we could not find out" degrading to "do not offer it" costs the
   * user nothing.
   */
  private availability: Observable<boolean> | null = null;

  /**
   * Whether to render a search box at all.
   *
   * 🔴 FALSE IS TODAY'S SHIPPED STATE. AddressLookupOptions.Provider defaults
   * to `None`, so until somebody installs the client's key this answers false
   * on every deployment — and the two forms must then look exactly as they did
   * before this feature existed.
   *
   * The same rule 2.47 applies to an empty dropdown: a control that can never
   * produce a result is worse than no control.
   */
  isAvailable(): Observable<boolean> {
    if (this.availability) {
      return this.availability;
    }

    this.availability = this.http
      .get<ApiResponse<{ available: boolean }>>(`${this.baseUrl}/availability`, this.quiet)
      .pipe(
        map((response) => response.data?.available === true),
        catchError(() => of(false)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.availability;
  }

  /**
   * Suggestions for a partial address, or an empty list.
   *
   * ⚠️ THE QUERY IS SENT AS TYPED. No trimming beyond the caller's own, no
   * case folding, and above all NO ASCII FILTERING — "रोहतक" has to reach the
   * provider and come back intact, and `HttpParams` percent-encodes it as UTF-8
   * for us. Sanitising a search term is how a Hindi locality becomes
   * unsearchable.
   */
  suggest(query: string): Observable<AddressSuggestion[]> {
    return this.http
      .get<ApiResponse<AddressSuggestion[]>>(`${this.baseUrl}/suggest`, {
        ...this.quiet,
        params: { q: query },
      })
      .pipe(
        map((response) => response.data ?? []),
        catchError(() => of<AddressSuggestion[]>([])),
      );
  }

  /**
   * One suggestion, in our own shape — or null, which means "use the dropdowns".
   *
   * ⚠️ NULL ARRIVES AS A 200. The controller answers
   * `Success<ResolvedAddress?>(null, "That place could not be resolved…")`
   * rather than a 404, so the ordinary path for "the provider went quiet
   * between the suggestion and the pick" is not an HTTP error at all. Both
   * shapes land here as null.
   */
  resolve(placeId: string): Observable<ResolvedAddress | null> {
    return this.http
      .get<ApiResponse<ResolvedAddress | null>>(`${this.baseUrl}/resolve`, {
        ...this.quiet,
        params: { placeId },
      })
      .pipe(
        map((response) => response.data ?? null),
        catchError(() => of(null)),
      );
  }
}
