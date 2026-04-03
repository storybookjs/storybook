# Open Questions

## Before/After Addon - 2026-04-01 (Revised v2)

### Resolved from v1 (no longer open)

- ~~**Vite Environment API in middleware mode**~~ - RESOLVED: Environment API is not viable. Environments serve different runtime targets (SSR, edge), not alternative browser content. Only `client` environment is HTTP-wired. Replaced with second Vite server approach.
- ~~**How to route requests to a specific Vite environment**~~ - RESOLVED: Not using environments. Second Vite server has its own `transformIndexHtml` and `middlewares`.
- ~~**Virtual module registration across environments**~~ - RESOLVED: Second Vite server runs the same plugin stack, so virtual modules are provided by the same `codeGeneratorPlugin` instance. No cross-environment concerns.

### Still Open

- [ ] **Second Vite server config cloning** - When we capture the config from `viteFinal` and clone it for the second server, how deep does the clone need to be? Vite plugins are stateful objects with closures. We may need to re-run `commonConfig` + `pluginConfig` to get fresh plugin instances rather than sharing them. — Determines Step 3 implementation approach. HIGH RISK.

- [ ] **Module path prefix for second server** - The second Vite server's middleware needs to be mounted under a prefix (e.g., `/before-preview/`). Does Vite's `middlewareMode` work correctly when the middleware is mounted at a sub-path? The `base` config option or a path-rewriting middleware may be needed. — Affects Step 3 route setup.

- [ ] **`storyIndexGenerator` preset availability** - The `codeGeneratorPlugin` resolves `storyIndexGenerator` via `options.presets.apply('storyIndexGenerator')`. When creating the second Vite server, we need the same `options` object. The addon's `viteFinal` receives `options` as the second argument — verify this provides access to the same presets. — Affects Step 3 config assembly.

- [ ] **Git show performance for large files** - Running `git show HEAD:<path>` for every changed file on first load could be slow. Caching strategy: cache by path, invalidate all on commit (HEAD change), never invalidate on working-dir edits (HEAD hasn't changed). — Affects Step 2 caching design.

- [ ] **Change detection status availability in manager** - The panel needs to know if the current story has changes. The `ChangeDetectionService` publishes to `StatusStore` with `CHANGE_DETECTION_STATUS_TYPE_ID`. Need to verify this data is accessible from manager-side code via `useStorybookApi()`. — Affects Step 4 conditional rendering.

- [ ] **HMR port conflict** - The second Vite server with `hmr: false` should not try to claim the HMR WebSocket. Verify that `server: { hmr: false }` fully disables HMR without side effects. — Affects Step 3 server config.

- [ ] **Package name convention** - Should this be `@storybook/addon-before-after` or another name? — User preference question.

- [ ] **Feature flag** - Should this addon be behind a feature flag initially? Given it's opt-in via `addons` array, a flag may be unnecessary. — Scope/rollout decision.
