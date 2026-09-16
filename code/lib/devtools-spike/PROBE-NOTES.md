# Devtools spike — probe notes (Next.js / Turbopack injection)

Consolidated findings for the Storybook DevTools spike. Every claim below is
either hand-on-verified during this probe (marked **verified**) or cited to
monorepo source (file:line, read in this session). Nothing else.

## 1. What ran

- App: `demo/next-probe` — minimal Next.js app router app, own `package.json`
  installed with npm (not the Yarn workspace). Exact pins verified with
  `npm ls` after install: `next@16.3.5`, `react@19.3.0`, `react-dom@19.3.0`.
- Runs executed (each in tmux, page loaded over HTTP, DOM inspected in a real
  browser via agent-browser):
  1. `next dev --turbopack` with a bare static import of the client entry in
     `app/layout.tsx`
  2. `next dev --webpack` with the same import
  3. `next dev --turbopack` with the import inside a `'use client'` layout
  4. `next dev --turbopack` + `next dev --webpack` with the working injection
     (client boundary + `useEffect` dynamic import) — final committed state
  5. `next dev` with no flag, to pin down which bundler the default picks
- Note on the brief's wording: in Next 16 **`next dev` (no flag) is
  Turbopack** — the startup banner reads `▲ Next.js 16.3.5 (Turbopack)`
  (**verified**, run 5). The webpack comparison therefore required the
  explicit `next dev --webpack` flag, which prints
  `▲ Next.js 16.3.5 (webpack)`.
- First attempt of run 1 returned HTTP 500 with
  `Module not found: Can't resolve '../../src/client/entry.ts'` — that was a
  bug in the probe itself (two levels up resolves to `demo/src/`, which does
  not exist); the correct depth is three (`../../../src/client/entry.ts`).
  Recorded because it is the exact error surface a wrong-depth import
  produces (**verified**).

## 2. Turbopack injection findings

### The literal one-line static import is silently dropped — in both bundlers

A bare static import of the client entry in `app/layout.tsx`:

```tsx
import '../../../src/client/entry.ts';
```

compiles cleanly under Turbopack **and** webpack — and then does nothing:

- Every served script chunk was fetched and grepped for
  `mountPanel` / `sb-devtools-spike-island` / `createInspector`
  (**verified**: 0 hits across all chunks in both modes; under Turbopack that
  includes the app chunk `chunks/code_lib_devtools-spike_demo_next-probe_*.js`).
- No SSR error, no client error, no island in the DOM — a silent no-op.
- Adding `'use client'` to `app/layout.tsx` does **not** rescue the import:
  same elimination, 0 marker hits across all 12 served chunks
  (**verified**, run 3).

Mechanism (high confidence, attributed not proven): `code/lib/devtools-spike/package.json`
declares `"sideEffects": false`, and a bare import whose bindings are unused
is eliminated as side-effect-free by bundlers that honor the flag — both
Turbopack and webpack do. We could not flip the flag to prove attribution
because the probe may not touch `package.json` (task guardrail); the
elimination itself is verified chunk-level evidence.

### SSR: the client entry cannot run in the server graph at all

`src/client/entry.ts` executes DOM work at module scope — `mountPanel()`
creates elements and appends to `document.body`
(`src/client/panel.ts`, `export function mountPanel`), and
`createInspector()` creates the overlay and attaches document-level listeners
(`src/client/inspector.ts`, `export function createInspector`). Any static
import reachable from the server graph (including from a `'use client'`
component, which Next still server-renders) would crash with
`document is not defined` if the module survived elimination. The Vite demos
never hit this because they are SPAs with no SSR pass.

### The minimal injection surface that actually works

`app/devtools-client.tsx` (committed):

```tsx
'use client';
export function DevtoolsClient() {
  useEffect(() => {
    void import('../../../src/client/entry.ts');
  }, []);
  return null;
}
```

rendered once from `app/layout.tsx`. Result (**verified** in the live DOM in
both modes, runs 4a/4b):

- Turbopack: the entry gets its own dynamic chunk
  (`chunks/code_lib_devtools-spike_src_client_entry_ts_*.js`), and the panel
  mounts: shadow-DOM island with the `sb-devtools` title, Inspect button,
  `⌥⇧D / Esc` hint, and the arming prompt. Evidence:
  `tc-4-turbopack-panel-mounted.png`, `tc-8-final-turbopack-panel.png`.
- webpack (`--webpack`): identical — panel mounts. Evidence:
  `tc-7-webpack-client-component-hover.png` (panel visible while hovering).

So the answer to "what does a real Next integration need" is three-fold:
a client boundary (SSR), a dynamic import (sideEffects:false elimination),
and `useEffect` (browser-only execution). One of the three alone is not
enough.

### Inspection works; source location does not (either bundler)

With the inspector armed (click Inspect or ⌥⇧D), hovering `ProbeCard`'s
`<h2>` (**verified** in both modes):

- Server components are invisible to the DOM→fiber walk. When `ProbeCard` was
  a server component, the card showed `SegmentViewNode <h2>` with Next's own
  props (`type: "page"`, `pagePath: "page.tsx"`) — RSC output is materialized
  through the flight payload, so the nearest function fiber is Next's segment
  wrapper, not the app component.
- After converting `ProbeCard` to a client component (`'use client'` +
  `useState`), the card correctly shows `ProbeCard <h2>` with
  `title: "Probe card"`. Component naming + shallow props preview work in
  both modes. Evidence: `tc-5` (Turbopack), `tc-6` (client component,
  Turbopack), `tc-7` (webpack).
- The source row is **"source unknown" in both modes**. In-page fiber
  inspection explains why (**verified** by evaluating in the live page):
  - React 19.3.0 keeps regime 2 and drops regime 1: `fiber._debugStack`
    exists (an `Error` with the `react-stack-top-frame` marker);
    `fiber._debugSource` is gone — consistent with the regime boundary
    documented in `src/client/source-location.ts` (verified against
    react@19.2.8 there; this probe extends it to 19.3.0).
  - Turbopack: the debug-stack frames point at
    `about://React/Server/file:///…/.next/dev/server/chunks/ssr/…` (SSR-captured
    — the element's debug stack comes from the server render pass) and at
    `fakeJSXCallSite` frames inside Next's
    `react-server-dom-turbopack` runtime chunk. Turbopack-served chunks carry
    **no `//# sourceMappingURL`** (**verified**: grep = 0 on the app chunk),
    so `symbolicateFrame`'s fetch-and-parse path finds no map → null.
  - webpack: frames use the `webpack-internal:///` scheme (unfetchable from
    the page) plus `about://React/Server/webpack-internal:///(rsc)/…` — even
    though webpack app chunks **do** carry `sourceMappingURL`
    (**verified**: 2 hits in `chunks/app/layout.js`), the stack never
    references a fetchable http chunk URL, so the resolver never gets a map
    to parse.
  - Net: the JSX call-site `Error`s in a Next App Router app are RSC/SSR
    artifacts, not client-bundle frames. A real Next integration needs a
    bundler-provided symbolication channel (Turbopack/webpack native
    mappings), not the fetch-the-chunk-and-parse-sourceMapURL approach the
    Vite demos use.

## 3. Embed parameters (repo source, as they exist)

Embedded previews are client-enforced URL parameters; no server involvement:

- `code/core/src/preview-api/modules/preview-web/UrlStore.ts:15-19` — preview
  selection uses only `?id=` / `?viewMode=`; manager-style
  `?path=/<viewMode>/<storyId>` is legacy compatibility, and `?viewMode=` is
  only ever set alongside `?id=`.
- `code/core/src/preview-api/modules/preview-web/UrlStore.ts:93-100` —
  `viewMode` is read from `query.viewMode` and must match `/docs|story/`,
  otherwise it falls back to the path-derived mode or `'story'`; the story id
  comes from the path or `query.id`.
- `code/core/src/preview-api/modules/preview-web/UrlStore.ts:47` — the store
  itself writes `id` / `viewMode` params.
- `code/core/src/preview-api/modules/preview-web/embedMode.ts:1-2` —
  `shouldEmbed` is exactly `new URLSearchParams(search).get('embed') === 'true'`;
  `embedMode.ts:6` — `shouldAutoplay` is true iff NOT embedded.

Spike consequence: the embedded preview iframe URL is
`?id=<storyId>&viewMode=story&embed=true` and needs no server round-trip.

## 4. MCP `components.json` manifests are tool-generated

The spike must consume manifests, never hand-write them:

- `code/core/src/core-server/utils/manifests/manifests.ts:1` imports
  `writeFile` from `node:fs/promises`; the module builds manifests from
  presets + docgen/story-docs service payloads and writes them as JSON
  (`writeFile` calls at `manifests.ts:236`, `:285`, `:315`, `:342`;
  `writeManifests(outputDir, presets)` export at `:350`).
- `registerManifests` (`manifests.ts:380`) wires the dev-server routes:
  `app.get('/manifests/:name.json')` (`:390`) and the
  `/manifests/components.html` debugger (`:421`).
- It is wired into the dev server at
  `code/core/src/core-server/dev-server.ts:22` (import) and
  `dev-server.ts:195` (`registerManifests({ app, presets: options.presets })`).

Spike consequence: the running Storybook dev server serves live manifests at
`/manifests/<name>.json`; the spike fetches those. Hand-writing a
`components.json` would fork a generated artifact.

## 5. Dual-regime source resolution — what worked, what the fallback needed

Status before this probe (verified in the Vite demos, recorded here for
consolidation): regime 1 (`element._source` / `fiber._debugSource`) resolves
React 18.3.1 directly; regime 2 for React ≥ 19.2 resolves either a direct
Babel source object (`@vitejs/plugin-react` emission) or an `Error` whose
stack is symbolicated through the bundle's source map (verified against
react@19.2.8 under Vite 7).

What the symbolication fallback needs (all implemented in
`src/client/source-location.ts`, dependency-free so the client script runs in
any bundler):

- a V8 stack parser handling both `at fn (url:line:col)` and bare
  `at url:line:col` shapes (`parseStackFrames`);
- an internal-frame filter (`isInternalFrameUrl`: `node_modules`,
  `/@vite/client`, `node:`, `react-jsx-dev-runtime`,
  `react_stack_bottom_frame`);
- same-origin fetch of the served module text, `sourceMappingURL` extraction
  from inline data URLs (base64 or URI-encoded) or external `.map` files;
- a dependency-free VLQ decoder + per-line nearest-preceding-segment lookup
  (`decodeVlqSegment`, `decodeMappings`, `originalPositionFor`), 1-based
  display coordinates;
- workspace-relative rendering by slicing absolute paths at the last `/code/`
  marker (`relativizeWorkspacePath`); `null` on any gap — the panel renders
  "source unknown" and never fabricates a position.

What this probe adds: the Next App Router introduces frame shapes the
fallback was never given — `about://React/Server/…` SSR chunk frames and
bundler-scheme frames (`webpack-internal:///`), plus Turbopack's mapless
chunks (see section 2). Regime 2's assumptions hold for React 19.3.0; the
environmental part (frames point at fetchable, mapped http URLs) holds for
Vite and fails for Next.

## 6. CI/danger notes for reviewers

Read from `scripts/dangerfile.ts` this session:

- **PR title** must match `/^[A-Z].+:\s[A-Z].+$/` — i.e. `Area: Summary`
  with both Area and Summary starting with a capital letter
  (`scripts/dangerfile.ts:95-96`; fail message at `:99`).
- **Exactly one change-type label**, from `pr-log.validLabels` in
  `code/package.json` (dangerfile imports `../code/package.json` at
  `scripts/dangerfile.ts:9` and reads `validLabels` at `:50`):
  `BREAKING CHANGE`, `feature request`, `bug`, `documentation`,
  `maintenance`, `build`, `dependencies` (`:71-76` enforces exactly one;
  `cleanup` is a skip-label and does not count).
- **Exactly one CI label** from `['ci:normal', 'ci:merged', 'ci:daily',
  'ci:docs']` (`scripts/dangerfile.ts:23`, enforced at `:79-83`).
- **Exactly one QA label** from `['qa:needed', 'qa:skip', 'qa:success']`
  (`scripts/dangerfile.ts:24`, enforced at `:86-90`).
- Forbidden labels include `ci: do not merge` and `in progress`
  (`scripts/dangerfile.ts:41-46`).
- **Body must contain a filled `#### Manual testing` section**
  (`scripts/dangerfile.ts:125` matches `/####\s*Manual testing/i`; the
  section must have content, enforced through `:155`).
- **Nx distributed CI does not run on PRs right now**: the
  `.github/workflows/nx.yml` header states (verbatim, lines 3-5): "NX Cloud
  license has expired. Triggers are disabled so this workflow does not run on
  PRs, pushes, or schedules. It can still be started manually via
  workflow_dispatch once the license is restored." The workflow's `on:` block
  is `workflow_dispatch` only. Reviewers should therefore not expect the `nx`
  check on this PR — what does run is the standard GitHub Actions +
  CircleCI surface (on the live PR at head `9b1e01b4a15`: 142 checks passed,
  0 failed, 10 skipped, 0 pending, per the PR record for #36337).

## 7. Environment and evidence index

- Node/npm inside the repo sandbox; npm install pulled `next@16.3.5`,
  `react@19.3.0`, `react-dom@19.3.0` (verified via `npm ls` immediately after
  install). `node_modules/` and `.next/` are gitignored under
  `demo/next-probe/.gitignore` — `git status` after install lists only the
  source files (**verified**).
- Screenshots (repo sandbox `/home/user/work/evidence/`, captured this
  session): `tc-4-turbopack-panel-mounted.png`, `tc-5-turbopack-hover-card.png`
  (SegmentViewNode card), `tc-6-turbopack-client-component-hover.png`
  (ProbeCard card), `tc-7-webpack-client-component-hover.png` (webpack
  parity), `tc-8-final-turbopack-panel.png` (final committed state).
- Gates: `yarn lint` → 0 errors (4868 pre-existing warnings across the
  monorepo, none introduced here; the two `import(extensions)` errors this
  work initially caused were fixed); `yarn fmt:check` → all files correctly
  formatted.
