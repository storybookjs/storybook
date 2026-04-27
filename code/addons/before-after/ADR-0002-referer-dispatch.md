# ADR-0002 — Referer-based dispatch for the before-iframe environment

**Status:** Accepted
**Date:** 2026-04-27
**Supersedes:** none (ADR-0001 was deleted with the subprocess approach)
**Related:** future ADR-0003 (builder-vite hook fallback if Referer becomes unreliable)

## Decision

The before-after addon's dev-server middleware (`before-environment-plugin.ts:configureServer`) decides per-request whether to route to the `storybookBefore` Vite environment based on either:

1. The URL contains `?env=before` (primary marker), OR
2. A same-origin `Referer` header pointing at `*/iframe.html?env=before` (recovery path).

A path-blocklist for `/node_modules/**` and `/.vite/deps/**` and the existing `BYPASS_PREFIXES` filter known non-Vite-pipeline endpoints out of `transformRequest`. `transformIndexHtml` continues to inject the marker into the bare entry-script tag of the iframe HTML; it is **load-bearing**, not defense-in-depth.

The addon also injects a passive observability beacon into the before-iframe HTML — a single `console.warn` if the iframe loaded without `env=before` on its own URL. It does NOT patch `fetch`, install `MutationObserver`s, or rewrite URLs at runtime.

## Decision Drivers

1. **Correctness of HEAD-vs-working-tree separation under HMR.** A single misrouted request poisons the moduleGraph for that file's lifetime; `handleHotUpdate`'s file-keyed filter then suppresses HMR for the working-tree side too. This is the failure mode the addon exists to prevent; no other driver outranks it.
2. **Surface-faithful test coverage.** The `(k.*)` probe family drives `server.middlewares.handle()` end-to-end with synthetic `IncomingMessage`/`ServerResponse` pairs — the same surface production traffic hits. Probes that call `beforeEnv.transformRequest()` directly cannot catch regressions in the middleware itself.
3. **Minimal blast-radius if Referer is unavailable.** Behavior must not regress to a *new* bug (500, hung request, crash) when `Referer` is stripped — only to today's bug (working-tree content in the before iframe). The diagnostic beacon makes the degradation visible.

## Alternatives Considered

| Option | Description | Verdict |
|---|---|---|
| **A — Builder-vite hook** | Extend `iframeHandler` in `code/builders/builder-vite/src/index.ts` to inject `?env=before` into the bare `<script src="virtual:/@storybook/builder-vite/vite-app.js">` at `iframe.html:95` based on the requested URL. | **Deferred to ADR-0003.** Violates the addon's invariant of zero builder-vite changes. Tracked as a follow-up if Referer trimming becomes prevalent. |
| **B — Referer-based dispatch** ✅ | Addon's `configureServer` middleware checks `Referer` for marker-less requests, with same-origin + path-blocklist guards. | **Chosen.** Lives entirely inside the addon. `transformIndexHtml` (load-bearing) continues to mark the entry script. Composes with existing bypass list. |
| **C — Per-request cookie** | Addon middleware sets a `storybook-env=before` cookie on the iframe HTML response and reads it on subsequent requests. | **Invalidated:** cookies are origin-scoped not iframe-scoped, so a same-origin sibling preview tab would be misrouted (worse cross-tab race than B). |
| **D — Service-worker URL rewriter** | Ship an SW that intercepts `fetch()` from the before-iframe and appends `?env=before`. | **Invalidated:** violates Principle #1 (no runtime URL synthesis in iframe), and SW registration in dev breaks Vite HMR's WebSocket origin checks. |

## Why Chosen

Smallest viable change addressing the actual leak — `vite:import-analysis` and `vite:optimized-deps` dropping the `?env=before` query on bare-spec resolutions for descendants of the entry script. Lives entirely inside `code/addons/before-after/`. No edits to `code/builders/builder-vite/`. Composes with the existing `BYPASS_PREFIXES`. Surface-faithfully testable via synthetic `IncomingMessage`/`ServerResponse` + `server.middlewares.handle()`.

## Consequences

### Positive
- The bug ("before-iframe shows working-tree content for descendants of the entry script") is fixed for the common case (same-origin, Referer not stripped, `/src/**` paths).
- Middleware dispatch decision is now authoritative and inspectable in one place (`configureServer`), simplifying future debugging.
- The observability beacon makes Referrer-Policy degradation visible to users — silent breakage becomes a console warning.

### Negative
- **`transformIndexHtml` is load-bearing.** The bare `<script src="virtual:/@storybook/builder-vite/vite-app.js">` at `code/builders/builder-vite/input/iframe.html:95` ships with no `?env=before` query baked in; this hook is the sole place that adds it. Removing or short-circuiting this handler regresses the entire propagation chain. The Referer-based dispatch in `configureServer` cannot recover this case because the entry-script request itself has no Referer (it IS the entry).
- **Cross-tab race** possible when two same-origin tabs each host a Storybook instance — one with the before-iframe open, the other a normal preview. The browser's Referer for a request initiated from tab B's preview may be tab A's before-iframe URL. **Mitigation:** the same-origin host check limits this to genuinely shared origins; the `/node_modules/**` and `/.vite/deps/**` blocklist keeps the most common collision domain (shared deps) out of `storybookBefore.transformRequest`. **Residual risk:** first-party `/src/**` modules belonging to tab B's app could still route through `storybookBefore`. `before-content-plugin.ts:46` skips files outside the git repo and outside the project root, so HEAD content is unchanged in practice. Probes (k.8/k.9) pin the moduleGraph behavior.
- **Referer-stripping degrades to today's bug.** Browsers, proxies, and `<meta name="referrer">` overrides can strip or trim `Referer`. When this happens, marker-less child requests are NOT routed to the before env and the iframe shows working-tree content for those descendants. The diagnostic beacon (`<script>` injected into the before-iframe `<head>`) makes this visible as a `console.warn`.
- **Diagnostic is observability, NOT a behavior shim.** The injected `<script>` does not patch `fetch`, install a `MutationObserver`, or rewrite any URLs. It emits one log line if a precondition for correct behavior is missing. Principle #1 ("no runtime URL synthesis in iframe") stays intact.
- **Bypass list is a maintenance liability.** Any new builder-vite endpoint added to known non-Vite-pipeline paths (e.g. a hypothetical `/sb-foo`) MUST be reflected in `BYPASS_PREFIXES` and a corresponding `(k.3.*)` probe added. Probe `(k.3.0)` enforces this via `BYPASS_PREFIXES.length === 4`. The README documents the contract.

## Follow-ups

- **ADR-0003 — builder-vite hook (Option A).** If browsers tighten Referer trimming (e.g. URL-only, no query) or if ecosystem feedback shows the diagnostic firing frequently, promote the marker-injection logic into `iframeHandler` so the entry HTML ships with `?env=before` baked in from the source of truth. Requires a coordinated builder-vite + addon release.
- **Richer diagnostic.** A future iteration could ship a passive `PerformanceObserver`-based check that watches the first ~50 network requests after iframe load and warns if any `/src/**` request was missing the marker. Out of scope this iteration per Step 5.5's decision tree.
- **Production-build sanity.** This ADR scopes only the dev path (`configureServer` only runs in dev). The production build path (`build()` in `builders/builder-vite/src/build.ts`) is untouched; if static-build before-after support is ever added, a separate ADR will scope the static-asset URL rewriting strategy.
- **`srcdoc` workaround.** If a downstream framework wraps the iframe in an `srcdoc` shell, the Referer becomes `about:srcdoc` which fails the same-origin check. Currently not supported; documented in README §Limitations.
