# Before/After Story Comparison Addon - Implementation Plan (Revised v2)

**Created:** 2026-04-01
**Revised:** 2026-04-01 (v3: separate port, fresh config assembly, fresh plugin instances)
**Status:** Draft - Awaiting Confirmation
**Estimated Complexity:** HIGH

---

## RALPLAN-DR Summary

### Principles

1. **Preview Parity** - The "before" iframe must render stories with the same decorators, args, theme, project annotations, and runtime globals as the main preview. This means re-assembling an equivalent Vite config from scratch using the same `commonConfig` + `viteFinal` pipeline, producing fresh plugin instances with their own closures. (`commonConfig` internally calls `pluginConfig`, so calling it once is sufficient.)
2. **Minimal Core Changes, Maximum Reuse** - Expose builder-vite's config assembly as public API rather than duplicating internals. Accept that one small core change (new exports from builder-vite) is better than fragile reimplementation.
3. **Reuse Existing Infrastructure** - Leverage existing `GitDiffProvider`, change detection statuses, addon/channel patterns, and the `viteFinal` preset pipeline.
4. **Vite-Only, Dev-Only** - Scoped to Vite builder in dev mode. No webpack. No static build. Graceful degradation for Vite 5 users (feature disabled, not broken).
5. **Lazy Initialization** - The second Vite server is only created when the "before" panel is first opened, avoiding startup cost for users who don't need it.

### Decision Drivers

1. **How to get a full Storybook preview for HEAD content** - Need the complete builder-vite entry chain (virtual modules, transformIndexHtml, runtime globals) serving HEAD-version files.
2. **How to serve HEAD-version modules** - Need to intercept module loading for changed files and return `git show HEAD:<path>` content.
3. **What core changes are acceptable** - The "no core modifications" guardrail conflicts with preview parity; we must decide what minimal surface to expose.

### Viable Options

#### Option A: Second Vite Server in `middlewareMode` (CHOSEN)

Re-assemble a fresh Vite config by calling `commonConfig(options, 'development')` a second time (which internally creates fresh plugin instances via `pluginConfig(options)`, each with their own closures), append the `before-content-plugin` to the returned config's `plugins` array, apply `viteFinal` via `options.presets.apply('viteFinal', freshConfig, options)`, then create a second `vite.createServer()` in `middlewareMode`. Bind the second server's middleware to its own `http.createServer()` listening on a dynamically-assigned port. The manager iframe points to `http://localhost:{secondPort}/iframe.html?id={storyId}`. Each server has completely independent plugin instances and module graphs.

**Required core change:** Export `commonConfig` from `@storybook/builder-vite` so the addon can assemble an equivalent Vite config for the second server. (`pluginConfig` is called internally by `commonConfig` and does not need to be exported separately.)

**Pros:**
- Full preview parity guaranteed (fresh plugins produce same virtual modules, same HTML transform)
- Clean isolation: separate HTTP server, separate module graph, no cross-contamination
- No URL prefix rewriting needed -- Vite root-relative paths (`/@id/`, `/@fs/`, `/@vite/`) work unchanged
- Lazy initialization avoids startup penalty
- The `load` hook override is clean and well-scoped
- Works with Vite 5 and Vite 6+

**Cons:**
- Memory overhead of a second Vite server (mitigated by lazy init)
- Requires exposing 1 function from builder-vite as public API (`commonConfig`)
- Uses a second port (minor UX concern, but transparent to the user since the iframe is embedded)

#### Option B: Screenshot-Based Comparison (REJECTED)

Capture screenshots of stories at HEAD and display static images side-by-side.

**Pros:**
- Works with any builder (webpack, vite)
- No second server needed
- Simpler implementation

**Cons:**
- Loses live interactivity (can't interact with controls, zoom, inspect elements)
- Screenshot capture requires headless browser infrastructure (puppeteer/playwright)
- Much heavier dependency footprint
- Screenshot timing/flakiness issues

**Why rejected:** The core value proposition of this addon is live, interactive comparison. Screenshots lose that entirely and introduce heavy dependencies.

#### Option C: Vite Environment API (REJECTED - from v1 plan)

**Why rejected:** Vite environments are for different runtime targets (SSR, edge workers), not for serving alternative browser content. Only the `client` environment's module graph is wired to HTTP middleware. There is no mechanism to serve a custom environment's modules to a browser iframe.

---

## ADR: Architectural Decision Record

**Decision:** Create a second Vite dev server in `middlewareMode` with a freshly assembled config (via `commonConfig(options, 'development')` + `viteFinal`), fresh plugin instances, and a `load` hook plugin to serve HEAD-version content. `commonConfig` internally calls `pluginConfig` to produce all fresh plugin instances. Bind it to its own `http.createServer()` on a dynamic port.

**Drivers:**
- Need full preview parity (decorators, args, theme, virtual modules, runtime globals)
- Need isolated module graph so HEAD-version and working-dir versions don't interfere
- Must work with existing Vite 5 and 6 peer dependency range
- Vite's root-relative internal paths (`/@id/`, `/@fs/`, `/@vite/`) are incompatible with URL prefix mounting

**Alternatives Considered:**
- Vite Environment API - rejected: environments don't serve browser content; only `client` env is HTTP-wired
- Screenshot comparison - rejected: loses interactivity, adds heavy dependencies
- Query parameter routing in single server - rejected: fragile query propagation in Vite resolver
- Replicating builder-vite internals from addon code - rejected: entry chain is deeply coupled (codeGeneratorPlugin, transformIframeHtml, virtual modules); reimplementing is fragile and unmaintainable
- URL prefix mounting (`/before-preview/`) - rejected: Vite internal paths are root-relative; rewriting all internal URLs is fragile and incomplete
- Capturing config from `viteFinal` hook - rejected: the config object is mutated by `vite.createServer()`'s internal `resolveConfig`; a captured reference points to post-resolution state that cannot be passed to a second `createServer`
- Sharing/cloning plugin instances - rejected: Vite plugins are stateful objects with closures; sharing causes double `configureServer` bindings and corrupted state

**Why Chosen:** A second Vite server on its own port with freshly assembled config and fresh plugin instances is the only approach that guarantees preview parity without reimplementing builder-vite internals. Fresh config avoids post-resolution mutation issues. Fresh plugins avoid shared-closure bugs. A separate port avoids URL-rewriting issues with Vite internals.

**Consequences:**
- `@storybook/builder-vite` gains 1 new public export: `commonConfig` (which internally calls `pluginConfig`; no need to export `pluginConfig` separately)
- Memory usage increases when the "before" panel is opened (second Vite server)
- The second server uses a separate dynamically-assigned port (cross-origin iframe on localhost is fine for visual display)
- The second server does NOT support HMR for the "before" view (it shows a static HEAD snapshot; user must manually refresh after commits)

**Follow-ups:**
- Consider making the second server's config assembly a first-class builder-vite API for other addons
- Consider adding HMR to the "before" view (watch `.git/HEAD` for commit changes)
- Consider webpack support via a different strategy if the feature proves valuable

---

## Context

The Before/After addon provides a visual comparison panel in Storybook's manager UI. When a developer has uncommitted changes to component files, the addon shows how the story looked at git HEAD alongside the current version, enabling instant visual regression detection during development.

### Key Existing Code

| Component | Location | Purpose |
|-----------|----------|---------|
| `GitDiffProvider` | `code/core/src/core-server/change-detection/GitDiffProvider.ts` | Gets changed/new files from git (has `getRepoRoot()` and `getChangedFiles()`) |
| `ChangeDetectionService` | `code/core/src/core-server/change-detection/ChangeDetectionService.ts` | Maps changed files to affected stories |
| `commonConfig` | `code/builders/builder-vite/src/vite-config.ts` | Assembles base Vite config (plugins, root, cache) |
| `pluginConfig` | `code/builders/builder-vite/src/vite-config.ts` | Assembles the full plugin stack (entry, CSF, externals, stats) |
| `createViteServer` | `code/builders/builder-vite/src/vite-server.ts` | Creates Vite server in middlewareMode with viteFinal |
| `codeGeneratorPlugin` | `code/builders/builder-vite/src/plugins/code-generator-plugin.ts` | Virtual modules: stories, addon setup, app entry, transformIndexHtml |
| `iframeHandler` | `code/builders/builder-vite/src/index.ts` | Serves `/iframe.html` via server.transformIndexHtml |
| `iframe.html` template | `code/builders/builder-vite/input/iframe.html` | HTML template with runtime global placeholders |
| `experimental_devServer` | `code/core/src/core-server/dev-server.ts:79` | Preset hook; fires BEFORE builder starts (can register routes but no Vite access) |
| `viteFinal` | `code/builders/builder-vite/src/vite-server.ts:40` | Preset hook; fires during Vite config assembly (can modify config) |

### Architecture Constraints Discovered

1. **`experimental_devServer` fires at line 79, before builder starts at line 126** - Can register routes on the polka app, but the Vite server doesn't exist yet. Routes registered here will work once the server is listening.
2. **The preview entry chain is internal to builder-vite** - `codeGeneratorPlugin` provides `VIRTUAL_APP_FILE`, `VIRTUAL_STORIES_FILE`, `VIRTUAL_ADDON_SETUP_FILE`. `transformIframeHtml` populates runtime globals. These cannot be replicated from an addon.
3. **`GitDiffProvider` only has `getRepoRoot()` and `getChangedFiles()`** - No `git show` method. We need to implement `git show HEAD:<path>` ourselves using `execa`.
4. **builder-vite supports Vite 5 as peer** - The Environment API only exists in Vite 6+. Our approach (second server) works with both versions.

---

## Work Objectives

Build `@storybook/addon-before-after` at `code/addons/before-after/` that:
1. Exposes `commonConfig` from builder-vite as public API (which internally calls `pluginConfig`; no separate export needed)
2. Creates a second Vite server (lazily) on a separate port with freshly assembled config, fresh plugin instances, and a HEAD-content `load` plugin
3. Registers a manager panel showing the "before" iframe side-by-side
4. Uses `git show HEAD:<path>` to serve HEAD-version file content
5. Integrates with existing change detection statuses
6. Gracefully degrades when git is unavailable or builder is not Vite

---

## Guardrails

### Must Have
- Full preview parity in the "before" iframe (same virtual modules, runtime globals, decorators, theme)
- `git show HEAD:<path>` for serving HEAD content (implemented in addon, not GitDiffProvider)
- Graceful degradation: Vite 5 users see "requires Vite 6+" message (if Environment API used) -- NOT APPLICABLE with Option A; works on Vite 5+
- Graceful degradation: non-Vite builders see "Vite builder required" message
- Graceful degradation: no git / no changes shows informational message
- Lazy second-server creation (only when panel is first opened)
- Addon panel always visible; contextual messages for inactive states

### Must NOT Have
- Webpack support
- Static build support
- Reimplementation of builder-vite internals (use real config via exports)
- HMR in the "before" iframe (static HEAD snapshot; refresh on commit via channel event)
- Breaking changes to existing builder-vite public API (only additive exports)

---

## Task Flow

```
Step 1: Builder-Vite Public API + Package Scaffolding
    |
    v
Step 2: Git Show Utility + HEAD Content Plugin
    |
    v
Step 3: Second Vite Server on Separate Port
    |
    v
Step 4: Manager Panel UI
    |
    v
Step 5: Change Detection Integration + Commit Watching
    |
    v
Step 6: Build System Registration + Testing
```

---

## Detailed TODOs

### Step 1: Builder-Vite Public API + Package Scaffolding

Expose builder-vite config assembly as public API and scaffold the addon package.

**Files to modify (builder-vite):**
- `code/builders/builder-vite/src/index.ts` - Add export: `export { commonConfig } from './vite-config';`

**Files to create (addon):**
- `code/addons/before-after/package.json` - Package manifest with exports for `.`, `./manager`, `./preset`
- `code/addons/before-after/build-config.ts` - Build entries (browser: manager; node: preset)
- `code/addons/before-after/src/constants.ts` - Addon ID, panel ID, param key, event names
- `code/addons/before-after/src/index.ts` - Main export (re-exports constants)
- `code/addons/before-after/tsconfig.json` - TypeScript config

**Files to modify (build system):**
- `scripts/build/entry-configs.ts` - Add `@storybook/addon-before-after` build entry
- `code/core/src/common/versions.ts` - Add version entry
- `code/package.json` - Add workspace reference

**Acceptance Criteria:**
- [ ] `commonConfig` is exported from `@storybook/builder-vite`
- [ ] Package structure matches the a11y addon pattern (exports map, build-config, tsconfig)
- [ ] `yarn install` succeeds with the new package
- [ ] `yarn nx compile @storybook/addon-before-after` succeeds (even with stub files)

---

### Step 2: Git Show Utility + HEAD Content Plugin

Implement the `git show HEAD:<path>` utility and the Vite plugin that intercepts module loading.

**Files to create:**
- `code/addons/before-after/src/node/git-file-at-head.ts` - Utility: `getFileAtHead(repoRoot: string, repoRelativePath: string): Promise<string | null>` using `execa('git', ['show', 'HEAD:<path>'])`
- `code/addons/before-after/src/node/before-content-plugin.ts` - Vite plugin with `load` hook

**Git show utility behavior:**
1. Takes a repo-relative file path
2. Runs `git show HEAD:<path>` via `execa`
3. Returns file content as string, or `null` if file doesn't exist at HEAD (new file)
4. Caches results in a `Map<string, string | null>` keyed by path
5. Provides `invalidateCache(path?: string)` method (clear one or all entries)

**Vite plugin behavior:**
1. Named `storybook:before-content-override`
2. In `load(id)` hook: check if `id` resolves to a file in the changed-files set
3. If changed: call `getFileAtHead()` and return the HEAD content
4. If unchanged or new file (no HEAD version): return `null` (fall through to default)
5. Does NOT apply to virtual modules (IDs starting with `\0` or `virtual:`)

**Acceptance Criteria:**
- [ ] `getFileAtHead` returns HEAD content for modified files
- [ ] `getFileAtHead` returns `null` for files that don't exist at HEAD
- [ ] `getFileAtHead` caches results and supports invalidation
- [ ] Vite plugin only intercepts real file modules, not virtual modules
- [ ] Errors from `git show` are caught and logged, not thrown

---

### Step 3: Second Vite Server on Separate Port

Create the second Vite server with freshly assembled config, fresh plugin instances, and its own HTTP server on a dynamically-assigned port.

**Files to create:**
- `code/addons/before-after/src/node/before-server.ts` - Factory for creating the second Vite server + HTTP server
- `code/addons/before-after/src/preset.ts` - Addon preset with `viteFinal` and `experimental_devServer` hooks

**Capturing the `options` reference:**
1. In the `viteFinal` hook: store the `options` parameter (Storybook `Options` type, the second argument to `viteFinal`) in a module-level variable. This is NOT the Vite config -- it is the Storybook options object needed to call `commonConfig(options, 'development')` later. Do NOT capture or reuse the Vite config object (it will be mutated by `resolveConfig`).
2. **Re-entrance guard (REQUIRED):** The addon's own `viteFinal` hook will be re-invoked when `options.presets.apply('viteFinal', freshConfig, options)` is called during second-server creation (because the addon's preset is part of the preset chain). The hook MUST include an early-return guard at the top:
   ```ts
   if (storedOptions) return config;
   ```
   Without this guard, any config modifications in the addon's `viteFinal` would silently apply to both servers (double-application). The guard detects that the second-server assembly is already in progress (i.e., `storedOptions` has been set) and returns the config untouched for the re-entrant call. Only the initial call from the main server's assembly should capture `options` and perform any config work.

**Second Vite server creation (`createBeforeServer`):**
1. Re-assemble config from scratch:
   - Call `commonConfig(options, 'development')` to get a fresh base config; this internally calls `pluginConfig(options)` producing fresh plugin instances (each with its own closures, not shared with the first server)
   - Append the `before-content-plugin` to the returned config's `plugins` array
   - Apply `viteFinal`: `await options.presets.apply('viteFinal', freshConfig, options)` so user/addon config hooks run. **Important:** this call will re-invoke the addon's own `viteFinal` hook. The hook must contain the re-entrance guard `if (storedOptions) return config;` (see "Capturing the `options` reference" above) to prevent double-application of any config modifications.
   - Do NOT call `pluginConfig(options)` separately — it is already called inside `commonConfig`
2. Configure the fresh config:
   - **Override `cacheDir`**: after calling `commonConfig(options, 'development')`, override the returned config's `cacheDir` to a separate path using `resolvePathInStorybookCache('sb-vite-before', options.cacheKey)`. Both Vite servers default to `.vite/` under the project root; sharing that directory causes file-lock contention and corrupted cache entries because both servers read/write the same module files simultaneously. A distinct `cacheDir` gives each server its own isolated cache.
   - Set `server.middlewareMode: true` (we manage our own HTTP server)
   - Set `server.hmr: false` (no HMR for the "before" view)
3. Create the Vite server: `const viteServer = await vite.createServer(freshConfig)`
4. Create a standalone HTTP server:
   - `const httpServer = http.createServer(viteServer.middlewares)`
   - `httpServer.listen(0)` (port 0 = OS assigns a free port)
   - Read the assigned port from `httpServer.address().port`
5. The server is created lazily on first panel open (triggered by channel event from manager)

**Port communication (via `experimental_devServer`):**
1. In `experimental_devServer` preset hook: listen for `before-after/request-server` channel event from manager
2. On event: lazily create the second server, then emit `before-after/server-ready` with `{ port: assignedPort }`
3. The manager panel uses the port to construct the iframe URL: `http://localhost:{port}/iframe.html?id={storyId}`

**`/iframe.html` handler on the second HTTP server:**

The second Vite server runs in `middlewareMode`, which means Vite does NOT register an `/iframe.html` route automatically. That route is registered by builder-vite's `iframeHandler` at `code/builders/builder-vite/src/index.ts:170` on the *first* server only — it is not part of Vite itself. The second HTTP server therefore has no handler for `/iframe.html` out of the box.

The addon must register its own `/iframe.html` route on the second HTTP server before it starts listening:

1. Read the HTML template from the builder-vite package: `require.resolve('@storybook/builder-vite/input/iframe.html')` (or the equivalent ESM import with `createRequire`).
2. Call `await beforeViteServer.transformIndexHtml('/iframe.html', htmlContent)` — this runs the `transformIndexHtml` hooks registered by `codeGeneratorPlugin` (runtime globals injection, entry script tags, etc.) against the fresh second-server instance.
3. Send the transformed HTML as the response with `Content-Type: text/html`.

Without this handler, navigating to `/iframe.html` on the second port returns a 404, and the "before" iframe never loads its Storybook preview.

**Why NOT URL prefix mounting:** Vite internal paths (`/@id/`, `/@fs/`, `/@vite/`, `/@react-refresh`) are root-relative. The iframe HTML's script tags and dynamic imports all use root-relative URLs. Mounting under a prefix would require rewriting ALL Vite internal URLs -- fragile and incomplete. A separate port eliminates this entirely.

**Why fresh config (not captured):** The config object passed to `viteFinal` is mutated by `vite.createServer()`'s internal `resolveConfig`. A captured reference points to post-resolution state that cannot be passed to a second `createServer`.

**Why fresh plugins (not shared/cloned):** Vite plugins are stateful objects with closures. `codeGeneratorPlugin` captures `storyIndexGeneratorPromise` and registers `configureServer` callbacks. Sharing plugin instances between two servers would cause double `configureServer` bindings and corrupted state.

**Key detail:** The `commonConfig(options, 'development')` call internally invokes `pluginConfig(options)`, producing new instances of `codeGeneratorPlugin`, `transformIframeHtml`, etc. Each instance gets its own closures bound to the second server via Vite's `configureServer` hook. The `before-content-plugin` (appended afterward) only overrides loading for real filesystem files that have git changes. Virtual modules (`VIRTUAL_APP_FILE`, etc.) are handled by the fresh `codeGeneratorPlugin` instance.

**Acceptance Criteria:**
- [ ] Second Vite server is created lazily on first panel open (not at startup)
- [ ] Config is assembled fresh via `commonConfig(options, 'development')` + `viteFinal` (not captured/cloned; `pluginConfig` is called internally by `commonConfig`)
- [ ] `cacheDir` is overridden to `resolvePathInStorybookCache('sb-vite-before', options.cacheKey)` so the second server uses a separate cache directory and does not contend with the first server's `.vite/` cache
- [ ] Plugin instances are fresh (not shared with the first server)
- [ ] Second server listens on its own dynamically-assigned port via `http.createServer()`
- [ ] A custom `/iframe.html` route is registered on the second HTTP server; it reads the builder-vite template, calls `beforeViteServer.transformIndexHtml('/iframe.html', template)`, and returns the result — because `middlewareMode` does not register this route automatically
- [ ] Vite root-relative paths (`/@id/`, `/@fs/`, `/@vite/`) resolve correctly (no prefix rewriting needed)
- [ ] Changed files serve HEAD content; unchanged files serve working-directory content
- [ ] Second server does NOT attempt HMR
- [ ] Port is communicated to manager via channel event

---

### Step 4: Manager Panel UI

Create the manager-side panel that displays the "before" iframe.

**Files to create:**
- `code/addons/before-after/src/manager.tsx` - Addon registration (panel + title)
- `code/addons/before-after/src/components/BeforeAfterPanel.tsx` - Panel component

**Panel behavior:**
1. Register via `addons.register()` + `addons.add()` with `type: types.PANEL`
2. When story has changes (based on change detection status): send `before-after/request-server` channel event, wait for `before-after/server-ready` with `{ port }`, then render an iframe pointing to `http://localhost:{port}/iframe.html?id={currentStoryId}`
3. When story selection changes: update iframe src
4. Use `useStorybookApi()` to get current story ID
5. Use `useAddonState()` or status API to check if current story is affected by changes
6. Inactive states with messages:
   - No changes: "No uncommitted changes detected for this story"
   - No git: "Git is not available - before/after comparison requires git"
   - Not Vite builder: "Before/after comparison requires the Vite builder"

**Acceptance Criteria:**
- [ ] Panel appears in addons panel area with title "Before/After"
- [ ] Iframe loads the correct story at HEAD version when changes exist
- [ ] Iframe updates when story selection changes
- [ ] Informational messages display for all inactive states
- [ ] Panel styling follows Storybook design system

---

### Step 5: Change Detection Integration + Commit Watching

Wire up to existing change detection and add commit reactivity.

**Files to modify:**
- `code/addons/before-after/src/preset.ts` - Add server-side channel events
- `code/addons/before-after/src/node/before-server.ts` - Add commit watching + cache invalidation
- `code/addons/before-after/src/components/BeforeAfterPanel.tsx` - Listen for refresh events

**Behavior:**
1. In the preset, set up a file watcher on `.git/HEAD` and `.git/refs/heads/` to detect commits
2. When a commit is detected:
   - Clear the `getFileAtHead` cache
   - Re-fetch changed files via `GitDiffProvider.getChangedFiles()`
   - If the second Vite server exists, invalidate its module graph for affected files
   - Emit `before-after/head-changed` channel event
3. The manager panel listens for `before-after/head-changed` and reloads the iframe
4. Use `CHANGE_DETECTION_STATUS_TYPE_ID` statuses (already emitted by ChangeDetectionService) to determine which stories have changes: `status-value:modified`, `status-value:new`, `status-value:affected`

**Channel events:**
- `before-after/head-changed` - HEAD changed (commit/checkout), reload "before" iframe
- `before-after/server-ready` - Second Vite server initialized successfully
- `before-after/server-error` - Second Vite server failed to initialize

**Shutdown/Cleanup:**

The addon must close both the second Vite server and the second HTTP server when Storybook shuts down to avoid port leaks and dangling processes. Register cleanup in the `experimental_devServer` hook (or equivalent teardown point):

1. Listen for `process.on('SIGINT', ...)`, `process.on('SIGTERM', ...)`, and the Storybook server's `close` event (if exposed).
2. On shutdown: call `await beforeViteServer.close()` to tear down the Vite dev server (clears watchers, plugin cleanup hooks, etc.), then `httpServer.close()` to release the port.
3. If the second server was never created (lazy init never triggered), skip the cleanup gracefully.
4. File watchers on `.git/HEAD` / `.git/refs/heads/` must also be closed in the same cleanup pass (already noted in the file watcher cleanup criterion below, but must be co-located with the server teardown code).

**Acceptance Criteria:**
- [ ] Panel correctly activates/deactivates based on change detection status
- [ ] Making a commit triggers iframe reload with new HEAD content
- [ ] Editing a file updates the panel for affected stories
- [ ] Channel events flow correctly between server and manager
- [ ] File watchers are cleaned up on server shutdown (no leaks)
- [ ] Second Vite server and HTTP server are closed on Storybook shutdown (SIGINT/SIGTERM/server close); no port or process leaks

---

### Step 6: Build System Registration + Testing

Register in build system and add tests.

**Files to modify:**
- `scripts/build/entry-configs.ts` - Build config (done in Step 1)
- `code/core/src/common/versions.ts` - Version entry (done in Step 1)

**Files to create:**
- `code/addons/before-after/src/__tests__/git-file-at-head.test.ts` - Unit tests for git utility
- `code/addons/before-after/src/__tests__/before-content-plugin.test.ts` - Unit tests for Vite plugin
- `code/addons/before-after/src/__tests__/BeforeAfterPanel.test.tsx` - Unit tests for panel UI

**Tests to write:**
1. `getFileAtHead` returns content for files that exist at HEAD
2. `getFileAtHead` returns null for files that don't exist at HEAD
3. `getFileAtHead` caches results and invalidation works
4. Vite plugin returns HEAD content for changed files
5. Vite plugin returns null for unchanged files
6. Vite plugin skips virtual modules
7. Panel shows iframe when story has changes
8. Panel shows message when story has no changes
9. Panel shows message when git is unavailable

**Acceptance Criteria:**
- [ ] `yarn nx compile @storybook/addon-before-after` succeeds
- [ ] `yarn nx check @storybook/addon-before-after` passes
- [ ] All unit tests pass
- [ ] Addon can be added to `.storybook/main.ts` and loads without errors
- [ ] Manual verification: panel shows HEAD version for a modified story

---

## Success Criteria

1. Adding `@storybook/addon-before-after` to `main.ts` addons array activates the panel
2. Modifying a component file causes the panel to show the HEAD version of affected stories
3. The "before" iframe renders with full preview parity (same decorators, args, theme, globals, virtual modules)
4. Making a commit updates the "before" view to reflect the new HEAD
5. The panel shows appropriate messages when inactive (no changes, no git, wrong builder)
6. No regressions to existing Storybook functionality or builder-vite behavior
7. The second Vite server is only created when the panel is first opened (lazy)
8. Works with both Vite 5 and Vite 6
9. All unit tests pass; TypeScript compiles without errors

---

## Open Questions

See `.omc/plans/open-questions.md` for tracked questions.
