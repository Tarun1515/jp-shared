import { withNativeFederation, shareAll } from '@angular-architects/native-federation/config';

/*==============================================================================
  jp-shared — the REMOTE. Runs on :4999 and stays running.

  The four apps are hosts. They do not contain a copy of this code: they fetch
  remoteEntry.json from here at runtime, and the four keys below become import
  map entries named `jp-shared/ui`, `jp-shared/core`, `jp-shared/models` and
  `jp-shared/pages` in every host's browser.

  That naming is not decoration — the import map key is built as
  join(remoteName, exposeKey), so `name` and these keys together ARE the
  specifiers the apps import. Renaming either breaks every app.
==============================================================================*/

export default withNativeFederation({
  name: 'jp-shared',

  /**
   * 🔴 The keys are `ui`, NOT the conventional `./ui`.
   *
   * The runtime builds each import map key as join(name, exposeKey) and does
   * not normalise the result, so `'./ui'` produces the specifier
   * `jp-shared/./ui` — which no host can import by that name:
   *
   *   Unable to resolve specifier 'jp-shared/ui' imported from ...
   *
   * Dropping the `./` makes the key exactly `jp-shared/ui`, which is what the
   * apps import and what their tsconfig `paths` map. The `./` form is only
   * needed by loadRemoteModule(), which nothing here uses.
   */
  exposes: {
    ui: './src/entries/ui.ts',
    core: './src/entries/core.ts',
    models: './src/entries/models.ts',
    pages: './src/entries/pages.ts',
  },

  /**
   * 🔴 singleton + strictVersion on Angular and rxjs.
   *
   * Two copies of @angular/core in one page means two InjectionToken classes,
   * two DI graphs and two copies of every service — a login that succeeds
   * while the shell still believes it is signed out. `strictVersion` makes a
   * version mismatch fail loudly at load time instead of producing that.
   */
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',

    /*
      🔴 leaflet IS BUNDLED INTO THIS REMOTE, NOT SHARED.

      `shareAll` would otherwise publish it as a shared external, which makes
      `leaflet` an import-map entry in every HOST's page that resolves back to
      a bundle here. Three things are wrong with that for this one dependency:

        1. IT CAN ONLY FAIL IN THE APPS. The probe page on :4999 is its own
           host and always resolves its own import map, so a missing or
           mis-keyed entry would look perfect here and throw "Unable to resolve
           specifier 'leaflet'" in jp-school — the exact failure the expose-key
           note above this exists to prevent, in the one place it is hardest
           to see.

        2. shareAll sets `singleton: true, strictVersion: true`, which is
           correct for Angular (two DI graphs is a broken login) and absurd
           here: the day any app installs a different leaflet, the WHOLE PAGE
           fails to load over a map library where two copies would be harmless.

        3. Skipping costs nothing, because the component imports leaflet
           DYNAMICALLY. esbuild emits it as a lazy chunk of the `ui` bundle, so
           it is downloaded the first time a <ui-map-picker> renders and never
           on a page without a map. No app needs leaflet in its own
           node_modules, and none should add it.

      ⚠️ Its CSS does not come this way at all — it is inlined into the
      component's own stylesheet, scoped to the component. See the long note in
      ui-map-picker.component.scss.
    */
    'leaflet',
  ],
});
