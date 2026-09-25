# Testing Expectations

This document is canonical for detailed testing practice: watch-mode commands, component and unit test guidance, `memfs` filesystem tests, and global stubbing rules. `AGENTS.md` owns the pointer to this file and the core testing expectations.

Watch-mode commands:

```bash
yarn test:watch
yarn storybook:vitest
```

When writing tests for components:

- Add or update `<Component>.stories.tsx` with stories covering each behavior; use `play` functions with `expect`, `userEvent`, `within` from `storybook/test`
- Mock external context (e.g. `ManagerContext.Provider`) inside story decorators or `beforeEach`
- Run `vitest --config code/vitest.config.storybook.ts <story-file>` to verify play assertions

When writing unit tests (utilities, hooks, non-React modules):

- Export functions that need direct tests
- Test real behavior, not just syntax patterns
- Use coverage when useful: `yarn vitest run --coverage <test-file>`
- Mock external dependencies like file system access and loggers
- Use Node's path.resolve to wrap expected FS paths when writing path-related tests, so they work on Windows

## Filesystem tests with `memfs`

For unit tests that touch `node:fs` / `node:fs/promises`, use [`memfs`](https://github.com/streamich/memfs) instead of real temp directories or wholesale `node:fs` mocks:

- Import `vol` from `memfs` and call `vol.reset()` in `beforeEach`
- Seed virtual files with `vol.fromNestedJSON({ '/absolute/path/file.json': '...' })` or memfs `writeFile` after redirecting spies
- Use `vi.mock('node:fs/promises', { spy: true })` and, in `beforeEach`, point `mkdir` / `writeFile` / `readFile` at `memfs.fs.promises` (see `code/core/src/shared/open-service/server.test.ts`)
- Assert disk state with `vol.toJSON()` when helpful

Do **not** use `/tmp` paths or replace `node:fs/promises` with a full async factory mock unless a test file already standardizes on the spy redirect pattern above.

## Globals in tests: never assign `globalThis.*` directly

> [!IMPORTANT]
> Under no circumstances may a test mutate a global by assigning it directly (e.g. `globalThis.FEATURES = {...}`, `globalThis.window = ...`, `global.fetch = ...`). Direct assignment leaks across tests and files — Vitest does not restore it — so it silently changes behavior in unrelated tests and creates order-dependent flakiness.

Use Vitest's global stubbing instead, which is tracked and restorable:

- Set a global with `vi.stubGlobal('FEATURES', { experimentalDocgenServer: true })`.
- Restore in `afterEach(() => vi.unstubAllGlobals())` (or enable `unstubGlobals: true` in the Vitest config so it resets before each test automatically).
- For a value used by every test in a file, stub it in `beforeEach` and unstub in `afterEach`; for a one-off override, call `vi.stubGlobal` inside that single test.
- Never capture-and-restore by hand (`const original = globalThis.X; ... globalThis.X = original`); `vi.stubGlobal` + `vi.unstubAllGlobals()` does this correctly, including deleting keys that did not previously exist.

This applies to all ambient globals, not just `FEATURES` (e.g. `window`, `document`, `navigator`, `fetch`, `IS_REACT_ACT_ENVIRONMENT`).
