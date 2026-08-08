# @tarun1515/jp-shared

Design system, session handling and HTTP plumbing shared by the four Staffroom
India apps: **jp-admin**, **jp-school**, **jp-teacher** and **jp-public**.

> 🔴 **Read `../jp-docs/PROJECT_MEMORY.md` before doing any work here.**
> `jp-docs` must be cloned as a sibling of this repository. It holds every
> locked architectural decision, and it is deliberately not copied into any
> other repo — three copies become three versions within a week.

This is a **library**, not an application. No routed components, no login page,
no environment-specific configuration. Anything an app must configure arrives
through an injection token (`JP_APP_IDENTITY`, `JP_API_CONFIG`).

Four apps depend on this package. A breaking change here breaks all four, so the
public API is one entry point and changes to it are a major version bump with a
CHANGELOG entry saying what broke.

---

## Repositories

All seven are cloned as siblings:

```
D:\Projects\
├── jp-docs\      ← PROJECT_MEMORY, HOW_TO_RUN, schema reference
├── jp-shared\    ← you are here
├── jp-admin\     :4200
├── jp-school\    :4300
├── jp-teacher\   :4400
├── jp-public\    :4500
└── jp-backend\   both APIs + all database scripts
```

---

## Working on it

```bash
npm install
npm run build          # -> dist/jp-shared
npm run build:watch    # rebuild on change
```

### Development — link, do not publish

Publishing for every change during design work is unworkable. Link instead, and
changes flow through immediately:

```bash
# here, once
npm run link          # builds, then npm link from dist/jp-shared

# in each app
npm run link:shared
```

> ⚠️ **Every app must set `"preserveSymlinks": true`** in its `angular.json`
> build options. Without it the linked package resolves its own
> `node_modules/@angular/core`, the app ends up with two copies of Angular, and
> every injection token fails at runtime with:
>
> ```
> NG0203: The `InjectionToken JP_APP_IDENTITY` token injection failed.
> `inject()` function must be called from an injection context...
> ```
>
> The message points at dependency injection and the cause is module
> resolution, which is why it costs people an afternoon. All four apps already
> have the flag set.

### Release

```bash
npm run version:bump          # package.json AND src/lib/version.ts together
# write the CHANGELOG entry
git commit -am "release: 1.1.0" && git tag v1.1.0 && git push --follow-tags
```

The tag triggers `.github/workflows/publish.yml`, which refuses to publish if
the tag, `package.json` and `JP_SHARED_VERSION` disagree.

Then, in each app:

```bash
npm run update:shared
```

---

## Versioning

Strict semver. Three things must always agree, and `npm run version:bump` is
what keeps them agreeing:

| | |
|---|---|
| `package.json` | what apps install |
| `src/lib/version.ts` | what apps log at bootstrap |
| the git tag | what CI publishes |

If they diverge, the drift check compares numbers that agree with each other
and with nothing real.

---

## Drift

Four apps, four `node_modules`, four independent copies. Fix a bug, update three
apps, forget the fourth — and that app carries it for weeks while building
perfectly cleanly.

Nothing prevents this; it is the cost of the independence the structure buys. So
it is made findable instead:

1. `JP_SHARED_VERSION` is stamped at build time
2. every app logs it at bootstrap, in dev mode only
3. `cd ../jp-docs && npm run check-versions` prints all four side by side and
   flags anything stale or linked

Run the check after any change here.

⚠️ **One session at a time.** Several agents or people editing this library
concurrently will conflict, and each app keeps building fine against its own
copy — so the conflict stays invisible until it is expensive. Pause, change,
build, re-link or update each app, run `check-versions`, resume.

---

## What is in here

| | |
|---|---|
| `src/styles/` | 13 SCSS partials — the design system. Shipped as assets |
| `src/ui/` | 17 `ui-*` components, plus the app and auth shells |
| `src/core/` | services, guards, interceptors, models, constants, utils, shared pages |
| `src/public-api.ts` | **the only entry point.** Nothing is importable from a deep path |

The single entry point is not pedantry: it keeps internals refactorable without
breaking four apps, and it is what would make a later move to Native Federation
cheap — the public surface stays identical and only the loading mechanism
changes.
