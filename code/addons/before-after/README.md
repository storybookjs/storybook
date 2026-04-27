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
- **Before** — a second preview that loads each module from its `HEAD` blob via
  `git show HEAD:<path>`, so you see what the same story looked like at the
  last commit.

There are two implementations of the "before" preview, gated by a build-time
environment variable:

| `STORYBOOK_BEFORE_AFTER_ENV_API` | Path | Notes |
|---|---|---|
| _unset_ (default) | Subprocess | A second Storybook is spawned in a child Node process, with its own Vite dev server. Maximal isolation; higher resource cost. |
| `1` | Vite Environment API | A single dev server hosts a second Vite environment (`storybookBefore`) for the before iframe. Lower overhead; idiomatic Vite 7 design. |

> **Restart required.** Both flags are read once when Storybook boots. Toggling
> the flag while a dev server is running has no effect — kill and re-start
> Storybook.

## Requirements

- Node 22+
- A Vite-based Storybook (`builder-vite` directly or via a Vite framework like
  `react-vite`, `vue3-vite`, `svelte-vite`, `web-components-vite`,
  `nextjs-vite`, …).
- Vite 5, 6, 7 or 8 on the subprocess path.
- **Vite ≥ 6** on the env-API path. The Environment API is stable in Vite 7;
  Vite 5 throws `BeforeAfterUnsupportedViteError` at `viteFinal` entry.

## Enabling the Environment-API path

```bash
STORYBOOK_BEFORE_AFTER_ENV_API=1 yarn storybook
```

You should see the same Changes page UI; the difference is that no second
process is spawned. The before iframe is served from a same-origin URL with the
`?env=before` query marker (the addon's middleware routes those requests
through the `storybookBefore` Vite environment).

## Sandbox templates that have been validated

- `react-vite/default-ts` — primary.
- `vue3-vite/default-ts` — secondary (must pass before subprocess deletion in a
  follow-up release).

## Architecture documents

- `ADR-0001-vite-env-api.md` — the design decision and its consequences.
- `AUDIT.md` — plugin-cache audit confirming no cross-env leakage in the active
  plugin chain.
- `.omc/plans/before-after-vite-env-api.md` (in repo root) — the consensus plan
  used to drive the implementation.

## Probes (regression guards)

Three vitest files guard the env-API path:

- `src/node/__tests__/before-env-routing.test.ts` — asserts coverage checkboxes
  (a)–(j) of the routing/rewrite spec.
- `src/node/__tests__/git-watchers-cleanup.test.ts` — asserts watcher
  lifecycle correctness (no late callbacks after cleanup).
- `src/node/__tests__/crash-containment.test.ts` — asserts the
  `AsyncLocalStorage` scope around `unhandledRejection`.

Run them locally with:

```bash
yarn vitest run --config code/addons/before-after/vitest.config.ts
```
