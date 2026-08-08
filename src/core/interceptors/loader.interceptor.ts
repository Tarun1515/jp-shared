import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoaderService } from '../services/loader.service';

/**
 * Set on a request to keep it out of the global spinner.
 *
 * Use it for anything the user did not explicitly wait for — typeahead
 * lookups, polling, background master preloads. Flashing a full-screen
 * spinner on every keystroke is worse than showing none.
 *
 * @example
 * this.http.get(url, { context: new HttpContext().set(SKIP_LOADER, true) })
 */
export const SKIP_LOADER = new HttpContextToken<boolean>(() => false);

/** Drives the global loading indicator from in-flight request count. */
export const loaderInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.context.get(SKIP_LOADER)) {
    return next(request);
  }

  const loader = inject(LoaderService);
  loader.show();

  // finalize, not tap: this has to run on success, failure AND unsubscribe.
  // A cancelled request that skipped hide() would leave the spinner up.
  return next(request).pipe(finalize(() => loader.hide()));
};
