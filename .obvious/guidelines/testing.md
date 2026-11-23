# Testing Expectations

This document is canonical for testing practice: which kind of test to write, how to run each suite, component and unit test guidance, `memfs` filesystem tests, global stubbing rules, and type tests.
`AGENTS.md` owns the pointer to this file.

> [!IMPORTANT]
> **For React components, write Storybook stories with `play` functions. Do NOT write `*.test.tsx` unit tests.**
> Behavior, accessibility, and interaction assertions belong in `*.stories.tsx` co-located with the component, executed via the Storybook Vitest project.
> Unit tests (`*.test.ts(x)`) are reserved for pure utilities, hooks, and non-React modules where rendering is not involved.

| Suite                     | Command                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Story tests (components)  | `yarn storybook:vitest`, or `vitest run --config code/vitest.config.ts <story-file>`                             |
| Unit tests                | `yarn test <pattern>` (e.g. `yarn test csf-tools`); the full suite is large, so run focused patterns while iterating |
| Unit tests in watch mode  | `yarn test:watch`                                                                                                |
| Visual validation         | Storybook UI or Chromatic                                                                                        |
| E2E                       | `yarn task e2e-tests --start-from auto` or `yarn task e2e-tests-dev --start-from auto`                           |
| Smoke checks              | `yarn task smoke-test --start-from auto`                                                                         |
| Tools attach coverage     | `cd code && yarn playwright test -c e2e-internal/playwright.config.ts e2e-internal/tools-attach.spec.ts` (same checkout as the running internal UI) |

Fork CI compiles with `--no-link` before unit tests to generate the declarations required by distribution contract tests.

Test runs print console output only for failing tests (`silent: 'passed-only'` in the root `vitest.config.ts`).
In `code/` packages, `code/vitest-setup.ts` routes direct `process.stdout` and `process.stderr` writes, such as `@clack/prompts` output, through the console, so the same rule applies to them.
Add `--silent=false` to see the logs of passing tests, for example `yarn test csf-tools --silent=false`.

When writing tests for components:

- Add or update `<Component>.stories.tsx` with stories covering each behavior; use `play` functions with `expect`, `userEvent`, `within` from `storybook/test`
- Mock external context (e.g. `ManagerContext.Provider`) inside story decorators or `beforeEach`

When writing unit tests (utilities, hooks, non-React modules):

- Export functions that need direct tests
- Test real behavior, not just syntax patterns
- Make the input and expected result easy to read together. For a mapper with stable output, prefer `toMatchInlineSnapshot` when it shows the full result more clearly, as in the automigration fix tests.
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

- Set a global with `vi.stubGlobal('FEATURES', { docgenServer: true })`.
- Restore in `afterEach(() => vi.unstubAllGlobals())` (or enable `unstubGlobals: true` in the Vitest config so it resets before each test automatically).
- For a value used by every test in a file, stub it in `beforeEach` and unstub in `afterEach`; for a one-off override, call `vi.stubGlobal` inside that single test.
- Never capture-and-restore by hand (`const original = globalThis.X; ... globalThis.X = original`); `vi.stubGlobal` + `vi.unstubAllGlobals()` does this correctly, including deleting keys that did not previously exist.

This applies to all ambient globals, not just `FEATURES` (e.g. `window`, `document`, `navigator`, `fetch`, `IS_REACT_ACT_ENVIRONMENT`).

## Type tests (`*.test-d.ts`)

Vitest type-checks `*.test-d.ts` files with the TypeScript 7 native compiler, the same one `yarn task check` uses. They are never executed at runtime.

- A package with type tests sets `test.typecheck.enabled: true` in its `vitest.config.ts`; the checker itself comes from `code/vitest.shared.ts`.
- Run them from the repo root with `yarn vitest run --project <project> test-d`, where `<project>` is the config's `test.name` or else the package name (e.g. `core`, `@storybook/angular`).
- Assert with `expectTypeOf` and use `// @ts-expect-error` for inputs that must be rejected; an unused directive fails the test.

## Mutation testing: finding idle tests

`scripts/mutation-testing` runs [Stryker](https://stryker-mutator.io) on the unit tests of one package at a time.
It reports _idle_ tests: tests that pass on the original sources and fail for no mutant they reach, so they would not notice the regressions Stryker can simulate in the code they run.

| Step                 | Command                                                       |
| -------------------- | ------------------------------------------------------------- |
| Install Stryker once | `yarn --cwd scripts/mutation-testing/stryker install`         |
| Run on packages      | `node scripts/mutation-testing/run.ts code/core code/lib/mcp` |
| Print every report   | `node scripts/mutation-testing/report.ts`                     |

How it runs:

- Stryker has its own Yarn project in `scripts/mutation-testing/stryker`. Its instrumenter needs Babel 8, and the root `resolutions` hold `@babel/traverse` and `@babel/types` at 7 for every workspace. The project links to the workspace's `vitest`, so the tests and the runner load the same copy.
- Stryker rewrites the package's sources in place while it runs, because workspace packages resolve to their real sources and a copy would be tested against unmutated code. The package must have no uncommitted changes: an interrupted run is undone with `git checkout`. Do not edit, build or test that package, or run a second package, until the run ends.
- Most packages take a few minutes on four cores, and `code/core` about an hour and a half.
- `--mutate <glob>` limits the mutated files (the default is the package's `src`), and `--resume` continues an interrupted run. Results live in `.cache/mutation-testing/<package>`, and `report.ts` also reads those of an interrupted run once its first pass has finished.
- A mutant in code that runs while a module loads is only tried against the tests that run that code again themselves. `--module-load-mutants` tries it against every pending test of the files that import the module, which is what a change to a module-level constant needs. That adds hours for `code/core`.
- `--pool forks` runs the tests in child processes. Use it when a test runner crashes with `SIGSEGV`, as `code/frameworks/angular-vite` does in worker threads.

How to read the report:

- It is not a mutation score. A test stops running once it has failed for one mutant, so most mutants are never tried against most tests and count as survived.
- An idle test that reaches mutants fails for no change Stryker can make to the code it runs. It may assert too little, or it may guard an absence, such as `returns undefined when there is no config`: no mutant adds behaviour, so such a test is idle and still worth keeping.
- An idle test that reaches no mutant only depends on something outside the mutated sources: a type, another package, a built `dist` file, a fixture, or a module-level constant without `--module-load-mutants`. Mutation testing cannot judge it. A test that only asserts types belongs in a `*.test-d.ts` file.
- Each package is judged against its own sources only, so a package whose tests exercise other packages, such as `code/lib/docgen-harness`, reports most of its tests as idle.
- Story tests and type tests are not covered: the Stryker Vitest runner does not support browser mode, and a type test cannot fail for a mutant.
