# Agent Instructions

Canonical agent guidance for `vite-plugin-storybook-nextjs`. `CLAUDE.md` symlinks here —
keep instructions here, don't duplicate.

This plugin aliases Next.js modules to Storybook-friendly mocks so portable stories run
under Vitest. It backs `@storybook/nextjs-vite` / `@storybook/experimental-nextjs-vite`.

## Quick start

- **pnpm only** (pinned via `packageManager`). Build: `pnpm build` (or `pnpm dev` to watch;
  restart Storybook after plugin changes).
- **Lint/format:** `pnpm check` / `pnpm check:write` — Biome `1.8.1`, `organizeImports` on
  (let Biome sort imports, don't hand-order).
- **Tests:** no root runner — `./example` is the harness: `pnpm test:all` or `pnpm storybook`.
- User-facing change → `pnpm changeset`. Tests/docs-only → no changeset.

## Deep dives — read only when the task matches

| If you are… | Read |
| --- | --- |
| Adding/changing a Next.js mock, or writing a story that overrides or asserts on a mock | [`docs/agents/mocks.md`](docs/agents/mocks.md) |

Don't load deep-dive docs unless the task matches — this file is meant to stay scannable.
