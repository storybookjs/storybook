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
- **Before** — a same-origin iframe served by a second Vite environment in the
  same dev server. The environment loads each module from its `HEAD` blob via
  `git show HEAD:<path>`, so you see what the same story looked like at the
  last commit.

Both previews share the same dev server — there is no second process and no
second `createServer()`. The before environment is registered via the addon's
`viteFinal` hook, and Vite's Environment API isolates its module graph from the
main `client` environment.

## Requirements

- Node 22+
- A Vite-based Storybook (`builder-vite` directly or via a Vite framework like
  `react-vite`, `vue3-vite`, `svelte-vite`, `web-components-vite`,
  `nextjs-vite`, …).
- **Vite ≥ 6** — Environment API is required. Vite 5 throws
  `BeforeAfterUnsupportedViteError` at `viteFinal` entry.

## Sandbox templates that have been validated

- `react-vite/default-ts` — primary.
- `vue3-vite/default-ts` — secondary.

## Probes (regression guards)

Three vitest files guard the addon:

- `src/node/__tests__/before-env-routing.test.ts` — asserts coverage checkboxes
  (a)–(j) of the routing/rewrite spec PLUS the `(k.*)` family of
  middleware-driven probes for Referer-based env dispatch (see ADR-0002).
- `src/node/__tests__/git-watchers-cleanup.test.ts` — asserts watcher
  lifecycle correctness (no late callbacks after cleanup).
- `src/node/__tests__/crash-containment.test.ts` — asserts the
  `AsyncLocalStorage` scope around `unhandledRejection`.

Run them locally with:

```bash
yarn vitest run --config code/addons/before-after/vitest.config.ts
```

## Limitations

- **Restrictive Referrer-Policy.** The before-iframe relies on its `Referer`
  header (with the `?env=before` query intact) to route descendant module
  requests back to the before environment. If a user's `<meta name="referrer">`,
  CSP, or reverse proxy strips or trims `Referer`, the addon degrades to
  serving working-tree content for those descendants. The before-iframe
  emits a `console.warn` if it loaded without `?env=before` on its own URL —
  watch DevTools for `[storybook/before-after]`. ADR-0002 documents the
  full failure mode and the planned ADR-0003 follow-up.
- **`srcdoc` iframe wrappers** are unsupported: `Referer` becomes
  `about:srcdoc` and fails the same-origin dispatch check.

## Maintenance notes

`BYPASS_PREFIXES` in `before-environment-plugin.ts` is the addon's
compatibility contract with `builder-vite` — the list of Storybook-internal
endpoint prefixes that the dispatch middleware must NEVER route through
`beforeEnv.transformRequest`. Adding to this list MUST be accompanied by a
corresponding `(k.3.*)` probe in `before-env-routing.test.ts`. The probe
`(k.3.0)` asserts `BYPASS_PREFIXES.length === 4` as a forcing function so
silent additions break CI. The `/sb-` entry is a wildcard prefix
intentionally capturing all Storybook-internal asset routes; reducing its
specificity requires a coordinated change.
