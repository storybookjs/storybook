# Plugin-cache audit — `@storybook/addon-before-after` (env-API path)

> Companion to `.omc/plans/before-after-vite-env-api.md` (Step 5).

## Purpose

When the Vite Environment API path is active (`STORYBOOK_BEFORE_AFTER_ENV_API=1`), the
addon's `before-environment-plugin` scopes its `transform` hook to the
`storybookBefore` environment, and `before-content-plugin` is registered with
`applyToEnvironment: env => env.name === 'storybookBefore'`. Vite 7's per-environment
moduleGraph isolates Vite's own caches between `client` and `storybookBefore`, but it
does **not** isolate arbitrary plugin closures: any plugin that keeps a
`Map`/`WeakMap`/`Object` declared at the top of its own module file will share that
state across both environments.

The risk is silent. A plugin that keys its module-level cache on a bare `id` (no
environment discrimination) can return cached output computed for the
working-tree content while the request is for the HEAD content (or vice-versa),
producing crossed renders that are very hard to debug.

This document records the audit performed for the active `react-vite/default-ts`
sandbox config. Re-run the audit if the plugin chain changes.

## Audit table

Legend:
- **AE** — `applyToEnvironment` plugin-level filter applied (Vite 7 native).
- **OK** — no module-level cache keyed on bare `id`; safe.
- **OK-via-rekey** — has a cache, but key already encodes per-environment data (e.g. file path that differs by env, or includes `env.name`).
- **WORKAROUND** — plugin has a cache that ignores env; mitigated by registering two explicit instances or by upstream patch.

| Plugin                                     | Verdict | Module-level cache? | Notes |
|--------------------------------------------|---------|---------------------|-------|
| `@storybook/csf-plugin` (this repo)        | OK      | No (`code/lib/csf-plugin/src/*.ts` has no module-level `Map`/`WeakMap` keyed on id). The plugin is recreated per `unpluginFactory` invocation, and `rollupBasedPlugin` returns a fresh hook bag each call. | The two-environment registration in builder-vite produces two independent factory instances. |
| `@vitejs/plugin-react`                     | OK-via-rekey | Yes — `const loadedPlugin = new Map()` at the top of `dist/index.js`. The cache is keyed on the **plugin name string** (`'vite:react-babel'` etc.), not on `id`. It memoises the resolved plugin instance, not the transformed module output. Safe across environments. | Confirmed by reading `node_modules/@vitejs/plugin-react/dist/index.js`. The refresh-runtime caches (`allFamiliesByID`, `helpersByRoot`, etc.) are scoped to the **browser runtime**, not the Node-side plugin. |
| `@mdx-js/rollup` (when MDX enabled)        | OK      | No module-level Map keyed on id. Fresh `MDXJsxComponents` AST visitor per call. | Re-audit if MDX version changes. |
| `vite-plugin-svgr`                         | OK      | No module-level cache. Each `transform` call instantiates a fresh `transformWithEsbuild` invocation. | — |
| builder-vite internal plugins              | OK      | The `code-generator-plugin`, `mdx-plugin`, `inject-export-order-plugin`, etc. either have no cache or cache by full request id (which differs across envs because it carries `?env=before`). | — |
| `before-content-plugin` (this addon)       | AE — intentional | `applyToEnvironment: env => env.name === 'storybookBefore'` on the entire plugin. Internally uses `git-file-at-head.ts:cache: Map<string, string \| null>`, keyed on repo-relative path. The cache is invalidated wholesale by `invalidateCache()` on HEAD changes (and per-path on file events). The `client` env never sees this cache because the plugin never runs there. | OK. |
| `before-environment-plugin` (this addon)   | AE on `transform` only | Top-level: `als` (`AsyncLocalStorage`), `unhandledListenerInstalled`, `activeChannel`, and the `serverByConfig` `WeakMap`. None are keyed on module id. The `transform` hook gates by `this.environment?.name === 'storybookBefore'`. | OK. |

## Audit procedure (re-runnable)

```bash
# From repo root.
grep -rE "^const [A-Za-z_]+ = new (Map|WeakMap|Set)\(\)" \
  node_modules/@vitejs/plugin-react/dist \
  node_modules/@mdx-js/rollup \
  node_modules/vite-plugin-svgr \
  code/lib/csf-plugin/src \
  code/builders/builder-vite/src
```

Inspect each hit. Decision tree:

1. Does the cache key include the module `id`?
   - No → OK (cache is for plugin metadata, not output).
2. If yes — does the `id` already differ across environments (e.g. carries `?env=before`)?
   - Yes → OK-via-rekey.
3. If no — open an upstream issue requesting `(env.name, id)` keying. Workaround: register two explicit plugin instances, each with `applyToEnvironment: env => env.name === '<name>'`.

## Upstream filings

None required as of this audit. The active plugin chain is clean.

## Re-audit triggers

Re-run if any of the following change:
- `@vitejs/plugin-react` major version bump.
- `@mdx-js/rollup` major version bump.
- A new addon adds a Vite plugin to the active sandbox config.
- builder-vite's plugin chain changes (`code/builders/builder-vite/src/plugins/`).

Probe-1 (`before-env-routing.test.ts` checkbox b) provides ongoing regression coverage by
asserting that `?env=before` requests dispatch through the `storybookBefore` environment
exclusively; cross-env cache leakage would cause the spy assertions there to fail.
