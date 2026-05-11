# ADR-0003 — Single-environment marker-based content routing

**Status:** Accepted
**Date:** 2026-05-11
**Supersedes:** ADR-0002 (Referer-based dispatch through a `storybookBefore` Vite environment)

## Decision

The before-after addon no longer registers a second Vite environment.
A single Vite environment (the default `client`) serves both working-tree and
HEAD content. The `?env=before` query marker is purely a content-routing
signal, propagated through `resolveId` and consumed by
`beforeContentPlugin.load`.

The mechanism in three sentences:

1. `transformIndexHtml` adds `?env=before` to entry script `src` attributes
   when the iframe is requested with `?env=before` (signal:
   `ctx.originalUrl` — passed by builder-vite's `iframeHandler` as the
   third argument to `server.transformIndexHtml`).
2. `beforeEnvironmentPlugin.resolveId` fires when either the source or the
   importer carries the marker; it strips the marker, delegates resolution
   via `this.resolve({ skipSelf: true })`, and reattaches the marker to
   the resolved id when the discriminator
   (`shouldRouteThroughBeforeEnv`) classifies the id as a project file
   or virtual module. `node_modules` and Vite-internal URLs are returned
   unmarked so that the client environment's `optimizeDeps` cache and
   `vite:import-analysis` CJS-ESM interop continue to apply.
3. `beforeContentPlugin.load` fires for any id containing the marker; it
   resolves the repo-relative path and returns `git show HEAD:<path>`
   content. Non-marked ids fall through to Vite's default disk loader.

`vite:import-analysis` rewrites every import to point at the resolved id
(with its query). The browser therefore fetches marked URLs for
marker-bearing modules, and Vite's default `transformMiddleware` routes
them straight back into the same pipeline. The moduleGraph keys on `id`,
so `/path/foo.ts` and `/path/foo.ts?env=before` are tracked as separate
modules and HMR isolation falls out of Vite's default behavior.

## Why the previous design (ADR-0002) was abandoned

The `storybookBefore` Vite environment + dispatch middleware model
produced two unfixable failure modes:

1. **Bare-spec subpath imports failed to resolve under the marker.**
   Vite's `vite:resolve` plugin matches the package `exports` map via
   strict-equality on a query-stripped specifier, but per-environment
   resolution was passing the marker-suffixed form. `import { create }
   from "storybook/theming/create?env=before"` failed with
   `Does the file exist?` for every workspace/npm subpath.
   The addon's `resolveId` hook attempted to strip the marker before
   delegating to `this.resolve`, but the `pre`-enforce plugins from
   builder-vite (registered before the addon in `viteFinal`) matched
   first, so the strip-and-re-attach never observed the bare specs.

2. **Per-environment `optimizeDeps` returned raw CJS files.** When
   resolution did succeed, the per-env optimizer's metadata did not
   include the bundle of `react/jsx-dev-runtime` (because per-env
   discovery was independent of the client env's scan). The
   import-analysis pass therefore emitted a raw named-import statement
   (`import { jsxDEV } from "/@fs/.../react/jsx-dev-runtime.js"`),
   which the browser rejected because the CJS-wrapped module exposes
   only `default`. The CJS-ESM interop wrap is applied only when the
   resolved URL is recognised as belonging to the env's optimized-deps
   metadata.

Both failure modes are eliminated by the single-environment model:
bare-spec resolution runs against the client env's resolver, and the
client env's `optimizeDeps` metadata is the same metadata
`vite:import-analysis` reads when deciding to apply the CJS wrap.

## Decision drivers

1. **Correctness of HEAD-vs-working-tree separation.** The marker on the
   id is the partition key; the moduleGraph guarantees no cross-pollution.
2. **No CJS interop drift.** All packages resolved as `node_modules` get
   the same pre-bundled URL the client environment uses; the
   import-analysis wrap follows automatically.
3. **No per-environment configuration to maintain.** No `optimizeDeps`,
   `resolve`, or `consumer` knobs to keep in sync with Vite upstream.

## Mechanism details

### Marker discriminator (`shouldRouteThroughBeforeEnv`)

```ts
function shouldRouteThroughBeforeEnv(id, repoRoot) {
  if (id.includes('env=before')) return false;     // already marked
  if (id.startsWith('\0')) return true;            // virtual modules
  const path = id.split('?')[0];
  if (path.startsWith('/@vite/')) return false;    // Vite internals
  if (path === '/@react-refresh') return false;    // Vite internals
  if (path.includes('/node_modules/')) return false; // deps stay in client env
  if (repoRoot && path.startsWith(repoRoot)) return true;
  return false;                                    // outside repo
}
```

- Virtual modules (`\0`-prefixed) MUST be marked. The
  `code-generator-plugin` (builder-vite) generates the iframe entry
  script (`virtual:/@storybook/builder-vite/vite-app.js`) and the
  per-iframe stories list. The marker on these virtual ids ensures
  their generated imports (`./setup-addons.js`, the project
  annotations virtual, etc.) flow through the same propagation chain.
- `node_modules` MUST NOT be marked. Pre-bundled deps are env-agnostic;
  marking would split them across moduleGraph entries and break the
  CJS-ESM interop.

### Plugin ordering — `preset.ts` prepends

`beforeEnvironmentPlugin.resolveId` must run BEFORE the builder-vite
pre-enforce plugins (`code-generator-plugin`,
`storybook-project-annotations-plugin`). It delegates via
`this.resolve({ skipSelf: true })`, observes the resolved id, and
attaches the marker. If the builder-vite plugins run first, they
return the resolved virtual id directly and the marker never lands.

`preset.ts:viteFinal` therefore prepends the addon plugins to
`config.plugins` rather than appending.

### Builder-vite query-tolerance

`code-generator-plugin` and `storybook-project-annotations-plugin`
strip the query before matching their virtual-id constants
(`SB_VIRTUAL_FILE_IDS`), then re-attach the query on the resolved id.
Without this, `id === 'virtual:/...'` strict equality misses the
marker'd form. These changes are inside `code/builders/builder-vite/`
because the virtual-module ownership is theirs.

### HTML entry-script marking

`builder-vite/src/index.ts:iframeHandler` calls
`server.transformIndexHtml('/iframe.html', html, originalUrl)` — the
3rd argument is the request URL (with `?env=before`). The first
argument MUST stay `/iframe.html` (no query) because Vite's
built-in `devHtmlHook` (which resolves `virtual:` script srcs to
`/@id/__x00__virtual:/...`) bails on paths with query strings.

The addon's `transformIndexHtml` hook reads `ctx.originalUrl`, rewrites
script/link/img URLs to include `?env=before`, and injects a
diagnostic beacon (a one-time `console.warn` if the iframe loaded
without the marker — defensive observability, no runtime patching).

The hook's `order: 'post'` is load-bearing: it must run AFTER
`@vitejs/plugin-react` injects the JSX-runtime preamble script so the
preamble URLs are also rewritten.

## Limitations

1. **HEAD-content modules ignore working-tree HMR.** The
   `handleHotUpdate` hook filters out modules whose id contains the
   marker. A working-tree edit to `/path/foo.ts` invalidates only the
   unmarked moduleGraph entry; the marker'd entry keeps serving HEAD
   content until a `HEAD_CHANGED` event from the addon's git watcher
   triggers `invalidateBeforeEnvironment` (which invalidates every
   marker-bearing module in the client environment's moduleGraph).
2. **Dynamic imports with non-literal specifiers.** `vite:import-analysis`
   only rewrites literal-string `import()` calls. A dynamic import
   computed at runtime stays unmarked and therefore loads working-tree
   content. This matches client-env behavior and is rarely an issue in
   story files.
3. **Pre-warming uses the client env.**
   `preset.ts:prewarmChangedStories` issues warmup requests with the
   marker (`/@fs/<path>?env=before`) against `server.environments.client`.
   There is no separate environment to warm.
