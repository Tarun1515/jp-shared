# Changelog

All notable changes to `@tarun1515/jp-shared`.

Strict [semver](https://semver.org/). The git tag always matches the version in
`package.json`, and both match `JP_SHARED_VERSION` in `src/lib/version.ts` —
`npm run version:bump` keeps the three in step so they cannot drift apart.

**A breaking change to the public API is a major bump, and the entry below says
exactly what broke and what to do about it.** Four apps consume this library from
four separate `node_modules`; anyone upgrading needs to know before they install,
not after their build fails.

---

## [1.0.0] — 2026-08-08

First release. Extracted from the single `frontend/portal` application when the
frontend was split into four independent apps.

### Added — design system

- 13 SCSS partials: tokens, mixins, typography, layout, buttons, forms, cards,
  tables, badges, auth, pipeline, utilities, theme. Shipped as assets and
  consumed through `stylePreprocessorOptions.includePaths`, so every app writes
  the same one-line `@use 'theme'`.
- 17 `ui-*` components, three files each.
- `ui-roll` — the application pipeline drawn as an attendance roll. The
  product's signature element; used at three sizes by the applicants table, the
  dashboard and the account-status page.
- `ui-app-shell` and `ui-auth-shell` — the chrome, shared so four apps cannot
  drift into four different shells. The auth shell's side panel is projected,
  not built in, because the apps have genuinely different things to say there.

### Added — core

- `AuthService`, `MenuService`, `MasterService`, `ToastService`,
  `LoaderService`, `ConfirmDialogService`, `TokenStorageService`.
- Three interceptors (loader, error, auth) and four guards (auth,
  active-account, role, permission).
- Shared pages: coming-soon, forbidden, not-found.
- `JP_APP_IDENTITY` and `JP_API_CONFIG` injection tokens. The library holds no
  environment-specific configuration; each app provides its own at bootstrap.
- `AppAccessService` — the cross-app login check. All apps authenticate against
  one SSO API, so a valid token can arrive at the wrong app; this signs the user
  out locally and names where they belong.
- `JP_SHARED_VERSION` and `logSharedVersion()` — the version each app logs at
  bootstrap, so drift between separately-installed copies is visible in seconds.

### Notes for consumers

- Set `"preserveSymlinks": true` in your `angular.json` build options. Without
  it a linked or symlinked copy of this library resolves its own
  `node_modules/@angular/core`, giving the app two copies of Angular, and every
  injection token fails with `NG0203`. This is the single most likely problem
  when wiring the library up for the first time.
