# jp-shared

The design system and application core for Staffroom India, served to the other
apps as a **Module Federation remote** on **http://localhost:4999**.

> 🔴 **Read `../jp-docs/PROJECT_MEMORY.md` before doing any work here** —
> decision **2.42** in particular. `jp-docs` must be cloned as a sibling.

> ⚠️ **One session edits this repo at a time.** Four projects depend on it, and
> each of them builds perfectly cleanly against whatever it finds. A conflict
> here is invisible until it is expensive.

---

## What this is now

It used to be an npm package consumed through `npm link`. It is not any more.

| | shared how | when |
|---|---|---|
| **JavaScript** — components, services, guards, models | Module Federation import map → this server | **runtime** |
| **SCSS** — tokens, mixins, partials | each app's `includePaths: ["../jp-shared/src/styles"]` | **build time** |

That split is the whole design. Run this once, leave it running, and a change to
a component shows up in a consuming app on reload — no publish, no version bump,
no link step.

---

## Running

```bash
npm install
npm start          # :4999 — START THIS BEFORE jp-admin, jp-school or jp-teacher
```

Opening http://localhost:4999 renders a small probe page that says the remote is
up and draws two real components. That page is not exposed and no app imports it;
it exists so "is the remote running?" has a visual answer.

```bash
npm run build      # production
```

> ⚠️ **Do not run a production build while any dev server is running.** They
> share the Native Federation externals cache, and a production build replaces
> the development copy of `@angular/core`. Consuming apps then die with
> `ReferenceError: ngDevMode is not defined`, which points nowhere near the
> cause. Fix: stop the dev servers, delete `.angular/cache`, start again.

---

## What is exposed — and the naming rule behind it

```
src/entries/ui.ts       → jp-shared/ui       17 ui-* components, both shells, overlays
src/entries/core.ts     → jp-shared/core     services, guards, interceptors, DI tokens
src/entries/models.ts   → jp-shared/models   types, constants, pure utilities
src/entries/pages.ts    → jp-shared/pages    coming-soon, forbidden, not-found
```

Those four barrels are the **entire** public surface. An app reaching past them
(`jp-shared/ui/ui-button/...`) is not an import map entry and fails at runtime,
which is the point: internals stay refactorable.

> 🔴 **The expose keys in `federation.config.mjs` are `ui`, not `./ui`.**
>
> The runtime builds each import map key as `join(name, exposeKey)` and does not
> normalise it, so the conventional `'./ui'` produces the specifier
> `jp-shared/./ui` — which no app can import:
>
> ```
> Unable to resolve specifier 'jp-shared/ui' imported from http://localhost:4300/
> ```
>
> Dropping the `./` makes the key exactly `jp-shared/ui`. The `./` form is only
> needed by `loadRemoteModule()`, which nothing here uses.

Adding an export means adding it to the right barrel. Adding a **new** barrel
means changing `exposes` here, plus `externals` and `tsconfig.paths` in every
host — so prefer the four.

---

## How the apps import it

They do **not** have this in `node_modules`. Each host declares the four
specifiers as `externals`, so its build leaves them unresolved; TypeScript
resolves them for types only, through `paths` pointing at `../jp-shared/src/entries/*`.

```ts
import { UiButtonComponent } from 'jp-shared/ui';
import { AuthService }       from 'jp-shared/core';
```

`initFederation` installs the import map before the app bootstraps, and the
browser resolves those bare specifiers to bundles served from here.

---

## 🔴 Angular must be a singleton

`@angular/core`, `common`, `router`, `forms` and `rxjs` are shared with
`singleton: true, strictVersion: true`, here and in every host.

Two copies of Angular means two `InjectionToken` classes, two DI graphs and two
of every service — a login that appears to succeed while the shell still thinks
it is signed out. `strictVersion` turns a mismatch into a loud load-time failure
instead of that.

Verified rather than assumed — with jp-school running against this remote:

| | |
|---|---|
| copies of `@angular/core` in the page | **1** |
| `JP_APP_IDENTITY instanceof ng.InjectionToken` | **true** |

The second row is the real proof: the token constructed **in this remote** is an
instance of the **host's** `InjectionToken` class. With two Angulars it is `false`.

---

## Styles

```
src/styles/    13 partials — the single source of truth for every token
```

Not served over federation. Each app puts `../jp-shared/src/styles` on its Sass
include path, so components everywhere keep writing `@use 'variables' as v;`.

Adding a token is a one-file change here.

> ⚠️ **CI must check out this repo alongside whichever app it is building**, or
> the build fails on the first component stylesheet.

---

## Layout

```
src/entries/    the four exposed barrels — the only public surface
src/ui/         17 ui-* components + ui-app-shell + ui-auth-shell
src/core/       services, guards, interceptors, models, constants, shared pages
src/styles/     13 SCSS partials
src/app/        the probe page served at :4999. Not exposed, not imported
src/main.ts     initFederation, then a dynamic import of ./bootstrap
```

> 🔴 **Nothing may be statically imported into `src/main.ts` except
> `initFederation`.** An import map only governs modules loaded after it exists,
> so anything imported at the top of that file escapes it — which is precisely
> how a second copy of Angular gets into the page.

---

## Production

This builds to static files served from a URL that each app reads from its
environment config, never hardcoded.

> ⚠️ **If this host is unreachable, all three apps fail to boot.** That is the
> accepted trade. **Mitigation: serve it from the same origin as the apps**, so
> there is no independent failure point — if that server is down, everything is
> down anyway.
