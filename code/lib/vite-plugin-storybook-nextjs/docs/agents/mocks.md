# Next.js mocks — authoring & testing

Deep dive referenced from [`AGENTS.md`](../../AGENTS.md). Read this when adding/changing a
Next.js mock or writing a story that overrides or asserts on one.

## Wiring a mock — five coordinated edits

Miss any one and the mock silently won't resolve:

1. **Alias module:** `src/plugins/next-mocks/alias/<name>/index.tsx` — the implementation.
   Use `fn().mockName(...)` from `storybook/test` for spies.
2. **Alias registration:** `getAlias()` in `src/plugins/next-mocks/plugin.ts` — register
   **all four** specifiers, each mapping to `getEntryPoint("<name>", env)`:
   - `next/<name>`
   - `@storybook/nextjs/<name>.mock`
   - `@storybook/nextjs-vite/<name>.mock`
   - `@storybook/experimental-nextjs-vite/<name>.mock`
3. **Build entry:** add the alias module path to `entry` in `tsup.config.ts`.
4. **Package exports:** add `./browser/mocks/<name>` (→ `…/index.js`) and
   `./node/mocks/<name>` (→ `…/index.cjs`) to `exports` in `package.json`.
5. **Changeset:** `pnpm changeset` (a new mock is user-facing).

## Stories that override / assert on a mock

Stories live at `example/src/app/components/<Name>/<Name>.stories.tsx` and run via
Storybook Vitest (`example/.storybook/vitest.setup.ts` → `setProjectAnnotations`).

- The **component under test** imports the real specifier (`import Link from "next/link"`);
  the Vite plugin alias swaps it for the mock at build time.
- To **override or assert on the spy**, import it from `@storybook/nextjs-vite/<name>.mock`
  (e.g. `@storybook/nextjs-vite/link.mock`). Canonical example: `Cache.stories.tsx`.
- `expect` / `within` come from `storybook/test`; jest-dom matchers
  (`toBeInTheDocument`, …) are available there even though existing stories rarely use them.
- Override a hook mock per-story with `beforeEach()` + `mockReturnValue(...)`. Storybook
  auto-resets `fn()` mocks between stories, so overrides don't leak.

### The non-obvious part

The bridge from import specifier to mock is the **plugin alias** (step 2), **not**
`package.json` exports. So:

- Do **not** import from `vite-plugin-storybook-nextjs/...` or a `./<name>.mock` subpath
  of this package — those don't exist.
- Naming asymmetry is expected and correct: `package.json` exposes
  `./browser/mocks/<name>` and `./node/mocks/<name>`, but the specifier consumers and
  stories use is `@storybook/nextjs-vite/<name>.mock`.

## Other gotchas

- Orphaned `__snapshots__/*.test.tsx.snap` files exist under some component dirs with **no**
  sibling `*.test.tsx` source (they snapshot a `Page`, unrelated to component stories).
  Adding stories doesn't touch them — don't "fix" them.
- No pre-commit hook in this repo; run `pnpm check` manually before committing.
