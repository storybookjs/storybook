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

### Plugins on core

- Frameworks, renderers, builders and addons import `@storybook/core/*` on the Node side.
- Postinstall code stays on `storybook/*`: it runs inside the end-user CLIs.
- `storybook` is an optional peer of plugins (required for Angular).

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

## Open questions

- Should no-port screenshots become the default once large bodies stop crossing the DevTools protocol?
- Webpack with the no-port transport is untested.
- Should addon-mcp and addon-vitest stop needing `storybook/*` at runtime (skills, CLI, product `createStorybook`)?
- Should the deep core exports stop leaking chunk paths?
