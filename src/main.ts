import { initFederation } from '@angular-architects/native-federation';

/**
 * 🔴 Nothing may be statically imported into this file except initFederation.
 *
 * Native Federation installs an import map, and an import map only governs
 * modules loaded AFTER it exists. Anything imported at the top of main.ts is
 * evaluated first and therefore escapes it — which is how a second copy of
 * @angular/core gets into the page. The real application entry point is
 * ./bootstrap, pulled in dynamically once the map is in place.
 */
initFederation()
  .catch((err) => console.error(err))
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));
