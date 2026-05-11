# `@storybook/addon-before-after`

Side-by-side comparison of stories rendered from your **working tree** ("after")
and from **`HEAD`** ("before"), so reviewing visual changes does not require a
manual git stash.

## How it works

The addon adds a Changes page to the Storybook manager. For every story whose
source (or the source of any of its dependencies) has changed since `HEAD`, the
page renders two iframes:

- **After** — the existing main Storybook preview, showing the working-tree
  rendering.
- **Before** — a same-origin iframe loaded with the `?env=before` query
  marker. The marker is purely a content-routing signal: the addon's
  `resolveId` hook propagates it from importer to resolved id, and a
  load-time hook (`beforeContentPlugin.load`) reads `git show HEAD:<path>`
  whenever the marker is present.

Both previews share the same dev server and the same Vite environment
(`client`). The marker drives `moduleGraph` partitioning — `/foo.ts` and
`/foo.ts?env=before` are tracked as separate modules — so HMR for
working-tree edits does not touch the before-iframe and HEAD updates from
the git watcher do not touch the after-iframe.

See [ADR-0003](./ADR-0003-single-env-marker-routing.md) for the full
design rationale.

## Requirements

- Node 22+
- A Vite-based Storybook (`builder-vite` directly or via a Vite framework like
  `react-vite`, `vue3-vite`, `svelte-vite`, `web-components-vite`,
  `nextjs-vite`, …).
- **Vite ≥ 6** — the Environment API surface used by builder-vite to mount
  multiple environments is required even though this addon only registers
  hooks on the default `client` environment.

## Sandbox templates that have been validated

- `react-vite/default-ts` — primary.
- `vue3-vite/default-ts` — secondary.

## Probes (regression guards)

Two vitest files guard the addon:

- `src/node/__tests__/before-env-routing.test.ts` — unit tests for the
  marker discriminator (`shouldRouteThroughBeforeEnv`), the load-gate of
  `beforeContentPlugin`, and an isolated `resolveId`-propagation probe
  driven through a real Vite dev server.
- `src/node/__tests__/crash-containment.test.ts` — asserts that a `load()`
  throw on a marker-bearing id does not poison the dev server.

Run them locally with:

```bash
yarn vitest run --config code/addons/before-after/vitest.config.ts
```

## Limitations

- **Dynamic imports with non-literal specifiers.** `vite:import-analysis`
  only rewrites literal-string `import()` calls. A dynamic import whose
  specifier is computed at runtime stays unmarked and therefore loads
  working-tree content. This is rarely an issue in story files but can
  affect mocked dynamic imports.
- **New files not committed to `HEAD`.** A story file that exists only in
  the working tree has no `HEAD` blob; the load hook returns `null` and
  Vite falls through to the working-tree read. The before iframe will
  show the same content as the after iframe for such files (the addon
  considers them "new", not "modified").
- **`srcdoc` iframe wrappers** are unsupported. A diagnostic beacon warns
  in the iframe console when `?env=before` is missing from its own URL.

## Maintenance notes

`shouldRouteThroughBeforeEnv` in `before-environment-plugin.ts` is the
discriminator that decides whether a resolved id should carry the
marker. Project paths (under `repoRoot`) and virtual modules
(`\0`-prefixed) are marked; `node_modules` and Vite-internal URLs
(`/@vite/...`, `/@react-refresh`) are NOT marked so the client
environment's `optimizeDeps` cache and CJS-ESM interop continue to
apply. Changing the discriminator without updating the unit test in
`before-env-routing.test.ts` fails CI explicitly.
