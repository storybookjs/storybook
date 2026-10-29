# Small core experiment

Branch `julien/experimental-rearchitecture`, cut from `next` at `a1c436e68ff`.
This branch never ships.
It exists to find every problem and to put numbers on the idea.

## The idea

Storybook becomes a small core with everything else as a client or a plugin.
One instance object replaces presets.
Plugins register hooks on that instance.
Tools, agents and tests talk to a running instance instead of loading the project themselves.

## What we built

### Packages

- `@storybook/core`: instance, hooks, services, toolsets, story index, preview, common.
- `@storybook/ui`: components and theming.
- `@storybook/manager`: manager UI and its builder.
- `storybook`: the product (CLI, dev server, compat layer, built-in features); re-exports the others.
- `@storybook/open-service`: the tools client (`createTools`).
- Direction: `core` ← `ui` ← `manager` ← `storybook`; `open-service` depends on `core` only.

### Instance API

- It is the root export: `import { createStorybook } from '@storybook/core'`.
- `createStorybook({ configDir, workingDir, mode: 'dev' | 'build' | 'headless', attach? })`.
- `defineAddon` with `setup(storybook)`.
- `main.ts` imports `defineMain` and `defineAddon` from `storybook`, which re-exports that subset of core's root; projects never list `@storybook/core`.
- One `defineMain`, typed by the framework: frameworks register their fields in core's `StorybookFrameworks`; the framework `/node` `defineMain` exports are deprecated aliases.
- `storybook.hook(name, fn, kind?)` and `callHook`.
- Every hook declares how results combine (`declareHooks`), or the registration passes `'reduce' | 'collect' | 'notify'`.
- `getStorybook`, `tryGetStorybook`, `runWithStorybook`, `bindToInstance` reach the current instance through async context.

### No presets

- Official packages ship `<pkg>/node` only.
- Renderers keep `./preset` as an exact alias of `./node` for third-party frameworks.
- Old preset specifiers map to native entries with a deprecation warning.
- `scripts/check/check-no-preset.ts` enforces it.
- First-party code calls `storybook.callHook` instead of `presets.apply`.
  - Before: 52 `presets.apply` calls across core, lib, and addons (49 once plugins registered built-ins through hooks).
  - After: 4, all in the compat layer (`compat/options.ts`, kept for third-party frameworks and builders).
  - `scripts/check/check-no-presets-apply.ts` enforces it for every package.

### Plugins on core

- Frameworks, renderers, builders and addons import `@storybook/core/*` on the Node side.
- Postinstall code stays on `storybook/*`: it runs inside the end-user CLIs.
- `storybook` is an optional peer of plugins (required for Angular).

### Every feature is an addon

- Built-ins (actions, backgrounds, controls, highlight, measure, outline, viewport, component testing, components manifest, review, checklist, what's new, open in editor, plus core's test, ghost stories, docgen, story docs and change detection) are addons in `storybook`'s `builtInAddons`.
- Review lives in `storybook` (`features/review/`): service handlers, toolset, staleness subscription, page-view telemetry and manager entry.
  - Core keeps the `core/review` service definition, its state transitions, events and routes: the manager UI registers the same service and can't import `storybook`.
  - Without `storybook`, tools have no `review` toolset; with it, the product's built-ins load as before.
- They contribute through the same hooks as any addon: `manager`, `preview:annotations:collect`, `server:app:extend`, `server:static-output:collect`.
- Presence is the switch: a built-in left out of the list ships nothing. Flags keep their old meaning: every built-in sets up, and its flag-gated parts (manager entry, components-manifest route and output) check the flags when collected, so any flag source works.
- The flag defaults moved from core to `storybook`.
- Gone: the generated `common-manager` bundle, the built-in exclusion in the product's manager collection, and core's `setCoreAnnotations` registry.

### Stores owned by the instance

- `UniversalStore` lost its static realm, `__prepare`, store inventory, and leader election.
- A store is an owner or a client, set where it is created, on an explicit channel.
- The instance creates and owns the status and test-provider stores and disposes them on close; an attached instance holds clients.
- Addon-vitest's runtime owns `storybook/test`; the Vitest child is a client over IPC.
- The manager's stores are clients on the page channel, or owners in a static build.
- The old adapters still work: `experimental_getStatusStore`, `experimental_getTestProviderStore`, `useUniversalStore`, `experimental_MockUniversalStore`.
- The checklist built-in owns `storybook/checklist` on the instance channel and disposes it on close.
- Not open-service: its state sync is multi-writer and has no fire-and-forget events, which these stores need (`TRIGGER_RUN`, `select`, `run-all`).

### Tools against a running instance

- The dev server serves a toolset RPC; its registry record advertises `toolsetRpc: 1`.
- The attached client is thin: no `createStorybook`, no `main.ts`, no plugins.
- Handlers run in the dev server, which also records telemetry.
- `storybook tools` picks its path before loading anything; older servers keep the delegated or child-host path.

### Screenshots

- `stories.screenshot` renders stories with Playwright from the project.
- With a dev server, it reuses its origin.
- Without one, a preview-only host serves the builder on a loopback port.
- A no-port transport answers Chromium's requests in-process; it is opt-in.

## Numbers

All measured on one Mac against base.

### Size

Gzipped package size, Storybook's own packages only (no third-party deps).
Base is `storybook@11.0.0-alpha.7` from npm with its README images (`assets/docs`, 2.3 MB of GIFs and PNGs) left out.

| What | Base | Branch |
| --- | --- | --- |
| Full product, 5 packages | 4.22 MB | 4.13 MB (−2%) |
| Tools only, core + open-service | 4.22 MB | 1.74 MB (−59%) |
| Plugin tarballs, 36 packages | 1,949 KB | 1,802 KB (−7.5%) |

- The split barely shrinks a full install: JS goes from 16.3 to 15.2 MB, `.d.ts` from 3.1 to 2.7 MB (unpacked).
- The win is for tools, agents and CI jobs, which no longer install the manager, CLI, dev server and components.
- Plugins lose their preset files and duplicate entries.
- The published base also ships its README images; the branch drops them (`"!assets/docs/**/*"`). That fix is independent of the split and can land on `next` alone.

### Dev startup and build

- Startup is at parity on react-vite, react-webpack, nextjs, vue3-vite and the internal Storybook, warm and cold.
- The Vite server phase costs +0.06–0.11 s; the browser phase wins most of it back.
- Static builds move within ±5%.

### Tools

| Call against a running dev server | Before | After |
| --- | --- | --- |
| `docs list`, warm | 0.85 s, 230 MB | 0.22 s, 101 MB |
| Screenshot, warm | 2.2 s, 260 MB | 0.8 s, 101 MB |

- The CLI loads 151 modules on that path instead of 275.
- The local path (`--no-attach`) still loads the project: +0.3 s over base.
- Headless `createStorybook` + `getIndex()`: 0.56 s → 0.60 s.

### Manager bundle

Measured on a react-vite fixture with esbuild, built-ins only.

| What | Base | One bundle per entry | Shared chunks |
| --- | --- | --- | --- |
| Manager files | 1 (`common-manager`) | 9 | 23 (9 entries, 14 chunks) |
| Bytes | 287,666 | 409,772 (+42%) | 290,724 (+1%) |
| Modules in more than one file | 0 | 28 (123 KB) | 0 |
| React copies | 1 (react-is) | 1 (react-is) | 1 (react-is) |
| `manager-api` copies | 0 | 0 | 0 |

- One bundle per entry repeated shared code: the open-service client and valibot (docgen, review), es-toolkit, and the global-externals shims (icons, components, `manager-api`) in every entry.
- Fix: the manager builder compiles all collected entries in one ESM build with code splitting, so any addon's shared code lands in a shared chunk.
- The HTML preloads every file and imports entries one by one in collection order; a failing entry is logged and skipped, as the old per-bundle `try`/`catch` did.
- A removed built-in contributes no entry, so its code is not built.
- React and `manager-api` stay external globals.

### Screenshot transports

- Port is the default.
- No-port is 24–30% slower warm: every response body crosses the DevTools protocol.

## Problems found

- Third-party frameworks resolve `@storybook/<renderer>/preset`; removing it broke them, hence the alias.
- Hooks registered without a strategy crash when the declaring package is absent (addon-docs on webpack projects).
- Relative `declare module` augmentations vanish from bundled `.d.ts`; type checks failed for every core consumer.
- `rolldown-plugin-dts` drops side-effect imports from `.d.ts` bundles (upstream bug; the build restores them).
- Manager and `storybook` `.d.ts` files point at hashed core chunks; rebuilding core alone breaks their types.
- Generated `package.json` exports put `types` before `code`, so workspace type checks read sibling packages from dist or source depending on what was built; the same class existed twice and `nx check` flaked. `code` now comes first; packing still strips it.
- Toolset handlers had no cancel signal; cancelling only stopped the wait.
- Sandboxes generated with `--no-link` can reuse stale registry tarballs.
- Symlinked template stories escape webpack's transpile rule.
- `storybook tools` evaluated `main.ts` for telemetry before every command, which hid the thin client's gain.
- Without a project config, the RPC path can't send the sanitized crash report; the error outcome still reaches the host.
- Portable stories composed the built-in annotations from a core registry; without it, runners other than addon-vitest lost them. `storybook` now exports one static list (`storybook/internal/preview/built-in-annotations`) that `storybook/preview-api` and the renderers' `definePreview` apply, while addon-vitest composes through `storybook/internal/preview-api`, which adds nothing.
- Filtering built-ins by flag before setup dropped their preview annotations (base only hid the manager UI) and ignored flags set from preset functions or setup hooks; flags are now read lazily in the collect handlers, matching base per flag.
- Deduplicating by name alone dropped Angular Vite's renderer, which shares the framework's name.
- Core services read `channel` and `configDir` from the preset options; called as a hook they got neither, so they now read the instance.
- Nothing deduplicated plugins, so an addon listed twice (or as a string and a native plugin) set up twice, and the checklist read a module-level story index promise instances never set; plugins now dedupe by name and the checklist reads the instance's generator.
- Node state lived in modules, so two instances in one process shared it: the MCP transport and origin, the Vitest child process and store, the project root (cached from the first `process.cwd()`), React's component-meta manager, and fallback readiness, dev-server subscriptions, module graph, and toolset registry.
  The second MCP endpoint answered with the first project's origin, and closing one instance killed the other's Vitest child.
  They now live on the instance, the fallbacks throw outside one, and `check-no-node-globals` blocks new module-level `let`/`var` in that code.
  The stores elected a leader per process realm from `VITEST_CHILD_PROCESS` and `attached`, and a timed-out follower had to be recreated; the instance now owns them and a client that timed out asks again.
  A toolset registered outside any instance landed in every instance's view; `registerToolset` and its readers now throw there, and tests run in a test instance.
- Server code read `process.cwd()` for save-story paths, the favicon, story lookups, and the Storybook cache; a host serving another directory resolved files in its own. It now reads the instance's `workingDir`.

## Open questions

- Should no-port screenshots become the default once large bodies stop crossing the DevTools protocol?
- Webpack with the no-port transport is untested.
- Should addon-mcp and addon-vitest stop needing `storybook/*` at runtime (skills, CLI, product `createStorybook`)?
- Should the deep core exports stop leaking chunk paths?
