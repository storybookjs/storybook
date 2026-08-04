# Storybook Agent Instructions

Keep this file, `AGENTS.md`, up to date when Storybook's architecture, tooling, workflows, or contributor guidance changes.

This file is the canonical instruction source for coding agents. Files like `CLAUDE.md` should point here instead of duplicating instructions.

## Repository Overview

Storybook is a large TypeScript monorepo. The git root is the repo root, the main code lives in `code/`, and build tooling lives in `scripts/`. The default branch is `next`.

- **Base branch**: `next` (all PRs should target `next`, not `main`)
- **Node.js**: `22.22.3` (see `.nvmrc`) — supports `.ts` natively via type stripping (no loader needed)
- **Package Manager**: Yarn Berry
- **Task orchestration**: NX plus the custom `yarn task` runner
- **Linting**: oxlint (root `.oxlintrc.json`, extended by `code/.oxlintrc.json` and `scripts/.oxlintrc.json`; custom rules load via `jsPlugins`). ESLint is no longer used for repo linting — `code/lib/eslint-plugin` remains as the published `eslint-plugin-storybook` package.
- **Formatting**: oxfmt (root `.oxfmtrc.json`)
- **CI environment**: Linux and Windows
- **TS execution**: Migrating from `jiti` to native `node` for running `.ts` files. New scripts should use `node ./path/file.ts` with explicit `.ts` import extensions (enabled by `allowImportingTsExtensions` in tsconfig). Legacy scripts still use `jiti` but should be migrated over time.
- **Type checking**: Per-package checks (`yarn task check`, `scripts/check/check-package.ts`) run on the TypeScript 7 native compiler (the `typescript-native` npm alias); diagnostics are filtered to the checked package. `@storybook/vue3`, `@storybook/docgen-harness` (for its `.vue` fixtures), and `@storybook/svelte` use `vue-tsc` / `svelte-check` (TS 6 based). The workspace `typescript` dependency stays on TS 6 for IDEs and API consumers, so tsconfigs must remain valid for both (e.g. no `baseUrl`).

## Repository Structure

```text
storybook/
├── .github/                      # GitHub configs and workflows
├── .nx/                          # NX workflow state
├── code/                         # Main codebase
│   ├── .storybook/               # Internal Storybook UI config
│   ├── core/                     # Core package published as "storybook"
│   ├── addons/                   # Core addons
│   ├── builders/                 # Builder integrations
│   ├── renderers/                # Renderer integrations
│   ├── frameworks/               # Framework integrations
│   ├── lib/                      # Supporting libraries
│   ├── presets/                  # Webpack-oriented presets
│   └── sandbox/                  # Internal build artifacts
├── scripts/                      # Build and development scripts
├── docs/                         # Documentation
├── test-storybooks/              # Test repos
└── ../storybook-sandboxes/       # Generated sandboxes outside repo
```

## Architecture

### Renderer vs builder vs framework

| Concept   | Role                                  | Example                   |
| --------- | ------------------------------------- | ------------------------- |
| Renderer  | Mounts UI framework to the DOM        | `@storybook/react`        |
| Builder   | Bundles and serves Storybook          | `@storybook/builder-vite` |
| Framework | Renderer + builder + framework config | `@storybook/react-vite`   |

### Core package

The main package is `code/core/src/`. The most important areas are:

- `core-server/` for dev server, static build, and presets
- `manager/` and `manager-api/` for the Storybook UI
- `preview/` and `preview-api/` for story rendering
- `channels/` for manager <-> preview communication
- `csf-tools/` for AST-based story indexing
- `common/` for shared Node.js utilities
- `test/` and `instrumenter/` for testing support

Public exports include:

- `storybook/actions`
- `storybook/preview-api`
- `storybook/manager-api`
- `storybook/theming`
- `storybook/test`

Internal exports include:

- `storybook/internal/core-server`
- `storybook/internal/csf-tools`
- `storybook/internal/common`
- `storybook/internal/channels`

### Key flow

- `.storybook/main.ts` is loaded at startup
- `.storybook/preview.ts` is bundled into preview (TSX for React-based frameworks)
- `.storybook/manager.ts` is bundled into manager
- `*.stories.*` files are indexed by AST before runtime
- Story selection loads the module, prepares the story, and renders it

AST indexing keeps the sidebar fast and prevents one broken story file from breaking the whole UI.

### Open services and toolsets

- OSA hosts two sibling constructs behind the `storybook/open-service` entry: **services**
  (`defineService`/`registerService`) own internal state, synchronization, queries, commands, and
  loading; **toolsets** (`defineToolset`/`registerToolset`) are the public agent surface for CLI/MCP.
  They live in mirrored trees: `open-service/services/` and `open-service/toolsets/`.
- All core OSA services are `internal: true` and may change without a public semver bump. Resolve
  internal services with `getService(id, { internal: true })`. A plain `getService(id)` throws when
  the service is internal.
- A toolset has an `id`, a description, a `telemetryGroup` (`'dev' | 'test' | 'docs'` — stories
  and review report under `dev`), and methods with five fields: `title` (the display label client
  UIs show — editable prose, not frozen), `description`, `schema` (input), optional `outputSchema`,
  and one `handler`.
- `handler(input, ctx)` returns a `ToolsetOutcome<TSuccess, TFailure = TSuccess>`: a discriminated
  union of `{ ok: true, data, markdown }` and `{ ok: false, data, markdown }`, written as plain
  object literals (no factory helpers). The one handler owns data, side effects, telemetry, and the
  rendered Markdown, because one MCP reply carries `content` (text) and `structuredContent` (JSON
  matching `outputSchema`) at once and both must come from a single run — re-running a method with
  side effects would repeat them. Usage telemetry reports inline in the handler with the rendered
  text in hand, so no consumer can forget it. Declare `TFailure = never` for infallible methods.
- The failure model, one line each: could not do the job → **throw**; did the job and the answer is
  bad news (a failed test run, a not-found lookup) → **return `{ ok: false, data, markdown }`**.
  Adapters unwrap mechanically — text blocks from `markdown`, `structuredContent` from `data`, MCP
  `isError` (and later CLI exit codes) from `ok` — and must not re-derive meaning from the data.
  `markdown` may be `string[]`: `preview-stories` renders one text block per URL; the CLI joins
  with newlines.
- An error whose message speaks to the agent and names its own recovery declares
  `agentFacing: true` (a `StorybookError` constructor prop). Adapters surface such errors verbatim
  by reading that property — never by keeping a class list, which misclassifies across bundle
  copies.
- The entry whose function throws a public error also exports that error class; catchers import
  both from the same specifier so plain `instanceof` is correct by construction (each core entry
  bundles its own copy of a class, so a class imported from a different entry is a different
  constructor). `storybook/open-service` exports the registry's own errors for exactly this reason.
- `ctx` is `{ consumer: 'cli' | 'mcp', origin?, uiRoot?, getService, telemetry? }`. `uiRoot` is
  where the consumer's Storybook UI is reachable when that differs from `origin` (sub-path-hosted
  dev server); methods that link into the UI prefer it, and the adapter derives it from the request.
  A method's `description` may be a function of `ctx`, so agent-facing prose lives with the
  capability. Name sibling tools through `getRef(ctx)` rather than hardcoding either spelling — it
  renders the frozen MCP tool name or the CLI command per consumer.
- Boot-time facts that vary prose (review enabled, a11y enabled) are factory options on the toolset,
  not ctx fields.
- `MCP_TOOL_NAMES` (`open-service/toolset-names.ts`) is the frozen public MCP contract. Both MCP
  packages register from it; changing an entry is a breaking change. Tool titles are not part of
  that contract — they live on each method as editable display prose.
- Toolsets register imperatively via `registerToolset`, called from the same place the paired
  service registers (the `services` preset hook for core and addons; the mechanism itself does not
  depend on the Node preset system). Feature gating is shared: a disabled feature registers neither
  the service nor its toolset. `registerToolset` throws on a duplicate id, and `getToolset(id)`
  throws when the id is unregistered — a missing toolset must fail loudly, never silently drop a
  tool. Registration sites today: `docs`, `stories` and `review` in core's `services` hook, `test`
  in addon-vitest's. Because a missing toolset fails loudly, register from `services` and not from a
  hook that only some runs reach: consumers resolve toolsets for their descriptions and schemas
  alone, including `storybook ai` metadata generation, which never starts a dev server. Whatever
  gates registration must match the gate that decides whether the tool is offered.
- The docs toolset is runtime-agnostic behind an injected `DocsAccess` (`list` + `resolve`), so one
  definition serves every runtime. Three accesses implement it — there is deliberately no fourth:
  `createServiceDocsAccess` (the open services), `createManifestDocsAccess` (the manifests core
  builds, the default) and `createProviderDocsAccess` (manifest files over any provider — HTTP, a
  static bundle, an authenticated proxy — following `$ref`s and validating on arrival). Which of
  the first two serves the local Storybook is decided by *registration*, not the
  `experimentalDocgenServer` flag: `createLocalDocsAccess` picks the services only when the docgen
  service actually registered (the flag alone is not enough — manager-only builds and a missing
  docgen worker skip that registration), and core's docs toolset and addon-mcp's composed local
  source share that selector. A test asserts the toolset never reaches `core-server`; keep it that
  way.
- Composition is access *composition*, not a second implementation: `createCompositionDocsSources`
  builds one access per source and `createDocsToolset({ sources })` adds the `storybookId` input,
  groups the listing per source, and isolates a failing source — unless every source fails, which
  is reported as one error instead of a page of them. Its `localAccess` option reads the source with
  no `url` directly, which is how the dev server reads itself the same way composed as it does
  alone; addon-mcp passes `createLocalDocsAccess` there in docgen-server mode rather than owning a
  second engine.
- `@storybook/mcp` and `@storybook/addon-mcp` both register their docs tools from that toolset
  through the dependency-light `storybook/internal/toolsets-docs` entry. `@storybook/mcp` takes
  `storybook` as a devDependency and bundles it, so its published dependencies must stay free of
  `storybook`; `addon-mcp` no longer depends on `@storybook/mcp` at all. A composition builds its
  toolset per request, because the provider and sources belong to the request.
- `toolsets-docs` is a **portable** entry (`portable: { external: [...] }` in
  `code/core/build-config.ts`): its d.ts is bundled in an isolated single-entry pass into one flat
  self-contained file whose only imports are the entry's declared allowlist (today exactly
  `valibot`), so consumers inline it through standard resolution with no custom resolver. A
  producer-side test next to the entry source (`portable-dist.test.ts`) asserts flatness, the
  allowlist, and a size budget — an edit that entangles the entry with react or another core
  surface fails core's own build. Its closure must not import core by bare name
  (`storybook/...`); import from the defining module instead of a barrel that does.
- Toolset factories are exported from `storybook/internal/core-server`, not `storybook/open-service`:
  they reach server-only code, and the latter entry is built for the browser.
- Still open: CLI generation and `storybook tools` wiring (Milestone 5).

## Common Commands

Run commands from the repository root unless stated otherwise.

For routine agent work, prefer the faster non-production commands first. Add `-c production` only when you need sandbox-related NX tasks or you are explicitly matching CI behavior.

### Install and compile

```bash
yarn
yarn task compile
yarn nx run-many -t compile
yarn nx compile <nx-project-name>
```

### Lint and typecheck

```bash
yarn lint
yarn --cwd code lint:js:cmd <file-relative-to-code-folder> --fix
yarn task check
yarn nx run-many -t check
```

### Development and tests

```bash
cd code && yarn storybook:ui
cd code && yarn storybook:ui:build
yarn test
yarn test:watch
yarn storybook:vitest
```

### Common task scenarios

| Scenario                        | Command                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Compile everything quickly      | `yarn nx run-many -t compile`                                                  |
| Compile one project             | `yarn nx compile <nx-project-name>`                                            |
| Check TypeScript errors quickly | `yarn nx run-many -t check`                                                    |
| Start the internal Storybook UI | `cd code && yarn storybook:ui`                                                 |
| Build the internal Storybook UI | `cd code && yarn storybook:ui:build`                                           |
| Run unit tests                  | `yarn test`                                                                    |
| Run Storybook Vitest tests      | `yarn storybook:vitest`                                                        |
| Generate a sandbox              | `yarn task sandbox --template react-vite/default-ts --start-from auto`         |
| Run sandbox E2E tests           | `yarn task e2e-tests-dev --template react-vite/default-ts --start-from auto`   |
| Run sandbox test-runner tests   | `yarn task test-runner-dev --template react-vite/default-ts --start-from auto` |
| Run the docgen perf bench       | `yarn workspace @storybook/docgen-harness bench:docgen-perf`                   |
| Run the docgen memory gate      | `yarn workspace @storybook/docgen-harness bench:docgen-memory`                 |
| Verify sandbox docgen baselines | `yarn workspace @storybook/docgen-harness baselines:sandbox`                   |

## NX and `yarn task`

Use NX when you want better caching and dependency tracking. Prefer these faster defaults first, and only add `-c production` or `--no-link` when you specifically need sandbox parity or CI-like behavior.

```bash
# Compile all packages
yarn task compile
yarn nx run-many -t compile

# Check all packages
yarn task check
yarn nx run-many -t check

# Run E2E tests for a template
yarn task e2e-tests-dev --template react-vite/default-ts --start-from auto
yarn nx e2e-tests-dev react-vite/default-ts -c production

# Jump to a later step
yarn task e2e-tests-dev --start-from e2e-tests --template react-vite/default-ts
yarn nx e2e-tests-dev -c production --exclude-task-dependencies
```

Key points:

- `-c production` is required for sandbox-related NX commands and CI-parity runs
- `react-vite/default-ts` is the default sandbox template
- `--no-link` is opt-in, not the default
- NX handles task dependencies via `nx.json`
- NX target commands use Nx project names (from `project.json` / Nx graph), not `package.json` names
- Example: `yarn nx compile core` (project `core` is published as package `storybook`)
- NX Cloud remote-cache auth failures (e.g. HTTP 401 "insufficient access") degrade to the local cache, so they are expected on local runs where `NX_CLOUD_ACCESS_TOKEN` is unset. CI always sets that token, so a 401 there means an invalid or expired token and should be investigated rather than ignored. A read-only token enables cache reads but cannot store artifacts, so the "wasn't able to store" warning is still expected with one

## Sandbox Notes

Sandboxes are generated outside the repository at `../storybook-sandboxes/` by default.

- `STORYBOOK_SANDBOX_ROOT=./sandbox` forces local output, but is usually not preferred
- `./sandbox` inside the repo mainly exists for NX outputs, not CI sandboxes
- If sandbox generation fails, fall back to `cd code && yarn storybook:ui`

Generate and use a sandbox with the same `sandbox` command shape used elsewhere in this file:

```bash
yarn task sandbox --template react-vite/default-ts --start-from auto
# Same sandbox step via NX
yarn nx sandbox react-vite/default-ts -c production
cd ../storybook-sandboxes/react-vite-default-ts
yarn install
yarn storybook
```

Common templates:

- `react-vite/default-ts`
- `react-webpack/default-ts`
- `angular-cli/default-ts`
- `svelte-vite/default-ts`
- `vue3-vite/default-ts`
- `nextjs/default-ts`

## How To Work In This Repo

### For normal code changes

1. Install if needed: `yarn`
2. Compile with NX: `yarn nx run-many -t compile`
3. Make changes
4. Recompile affected packages
5. Validate there are no TypeScript errors with `yarn nx run-many -t check`
6. Run relevant lint and tests
7. Validate behavior in the internal Storybook UI first, then switch to sandbox or `-c production` flows only if you need template or CI parity

### For addon, framework, or renderer work

1. Edit the relevant package under `code/addons/`, `code/frameworks/`, or `code/renderers/`
2. Recompile with NX, starting without `-c production`
3. Generate a matching sandbox
4. Run the relevant test-runner, E2E, or Storybook UI validation flow

## Testing Expectations

> [!IMPORTANT]
> **For React components, write Storybook stories with `play` functions — do NOT write `*.test.tsx` unit tests.** Behavior, accessibility, and interaction assertions belong in `*.stories.tsx` co-located with the component, executed via the Storybook Vitest project (`yarn storybook:vitest` or `vitest run --config code/vitest.config.storybook.ts`). Unit tests (`*.test.ts(x)`) are reserved for pure utilities, hooks, and non-React modules where rendering is not involved.

- Use `yarn storybook:vitest` to run Storybook story tests (the primary test path for components)
- Use `yarn test` for unit tests of utilities, hooks, and non-React modules
- Prefer focused unit-test runs during iteration — the full suite is large: `yarn test <pattern>` (e.g. `yarn test csf-tools`)
- Use Storybook UI or Chromatic for visual validation
- Use `yarn task e2e-tests --start-from auto` or `yarn task e2e-tests-dev --start-from auto` for E2E coverage
- Use `yarn task test-runner --start-from auto` or `yarn task test-runner-dev --start-from auto` for test-runner scenarios
- Use `yarn task smoke-test --start-from auto` for smoke checks

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

### Filesystem tests with `memfs`

For unit tests that touch `node:fs` / `node:fs/promises`, use [`memfs`](https://github.com/streamich/memfs) instead of real temp directories or wholesale `node:fs` mocks:

- Import `vol` from `memfs` and call `vol.reset()` in `beforeEach`
- Seed virtual files with `vol.fromNestedJSON({ '/absolute/path/file.json': '...' })` or memfs `writeFile` after redirecting spies
- Use `vi.mock('node:fs/promises', { spy: true })` and, in `beforeEach`, point `mkdir` / `writeFile` / `readFile` at `memfs.fs.promises` (see `code/core/src/shared/open-service/server.test.ts`)
- Assert disk state with `vol.toJSON()` when helpful

Do **not** use `/tmp` paths or replace `node:fs/promises` with a full async factory mock unless a test file already standardizes on the spy redirect pattern above.

### Globals in tests: never assign `globalThis.*` directly

> [!IMPORTANT]
> Under no circumstances may a test mutate a global by assigning it directly (e.g. `globalThis.FEATURES = {...}`, `globalThis.window = ...`, `global.fetch = ...`). Direct assignment leaks across tests and files — Vitest does not restore it — so it silently changes behavior in unrelated tests and creates order-dependent flakiness.

Use Vitest's global stubbing instead, which is tracked and restorable:

- Set a global with `vi.stubGlobal('FEATURES', { experimentalDocgenServer: true })`.
- Restore in `afterEach(() => vi.unstubAllGlobals())` (or enable `unstubGlobals: true` in the Vitest config so it resets before each test automatically).
- For a value used by every test in a file, stub it in `beforeEach` and unstub in `afterEach`; for a one-off override, call `vi.stubGlobal` inside that single test.
- Never capture-and-restore by hand (`const original = globalThis.X; ... globalThis.X = original`); `vi.stubGlobal` + `vi.unstubAllGlobals()` does this correctly, including deleting keys that did not previously exist.

This applies to all ambient globals, not just `FEATURES` (e.g. `window`, `document`, `navigator`, `fetch`, `IS_REACT_ACT_ENVIRONMENT`).

## Quality and Logging

After changing files:

1. **Always** format with `yarn fmt:write`, run from the `code/` directory (`cd code && yarn fmt:write`), once you are done editing. The repo uses `oxfmt`, so hand-written formatting will frequently be wrong — do not skip this step.
2. Lint with `yarn --cwd code lint:js:cmd <file-relative-to-code-folder> --fix` or `cd code && yarn lint:js:cmd <file-relative-to-code-folder>`
3. Run relevant tests before submitting a PR

Use Storybook loggers instead of raw `console.*` in normal code paths:

- Server-side: `storybook/internal/node-logger`
- Client-side: `storybook/internal/client-logger`

For TypeScript source in the repo, prefer explicit file extensions for relative code imports and exports such as `./foo.ts` or `./bar.tsx` when the target is another TS/JS module in this repository. Keep framework-specific component imports like `.vue` and `.svelte` in the form already expected by their package tooling.

The pre-commit hook automatically detects AI agents (via `std-env`) and switches from check-only to write mode, so formatting is auto-fixed when agents commit.

Avoid `console.log`, `console.warn`, and `console.error` unless the file is isolated enough that importing the logger is not reasonable.

## Troubleshooting

- Build failures are often fixed by rerunning `yarn` and `yarn nx run-many -t compile`
- Storybook UI uses port `6006` by default
- Large compiles may require more Node.js memory
- Sandbox paths are `../storybook-sandboxes/`, not `./sandbox` or `code/sandbox/`
- Use `--debug` for verbose CLI output
- Check generated sandbox directories and `.cache/` for build artifacts

## Environment Variables

| Variable                      | Purpose                                         |
| ----------------------------- | ----------------------------------------------- |
| `IN_STORYBOOK_SANDBOX`        | Set during sandbox creation                     |
| `STORYBOOK_DISABLE_TELEMETRY` | Disable telemetry                               |
| `STORYBOOK_TELEMETRY_DEBUG`   | Log telemetry events                            |
| `DEBUG`                       | Enable debug logging                            |
| `FIX_ON_COMMIT`               | Force autofix for fmt & lint in pre-commit hook |
| `NX_CLOUD_ACCESS_TOKEN`       | Authenticate the NX Cloud remote cache          |

## Commands To Avoid

- **DO NOT RUN** `yarn task dev` without an explicit sandbox template
- **DO NOT RUN** `yarn start`

These usually start long-running development servers and are the wrong default for agents.

## Code Authoring Principles

These are recurring failure modes in agent-authored changes to this repo. Apply them when writing or reviewing code, not just when asked.

- **Write comments only for the two reasons in [Comments and JSDoc](#comments-and-jsdoc).** That section is the rule; this list does not restate it.
- **Verify environment assumptions empirically before encoding them.** If a design rests on "the bundler strips X" or "this metadata is empty here", prove it with a throwaway probe before building on it (and before writing it into a comment as fact). A 10-line experiment is cheaper than a wrong architecture.
- **Encode assumptions with static checks first.** If an assumption is expected to always hold, prefer making it impossible via TypeScript types and existing lint rules. When static checks are not practical, add a cheap runtime assertion close to the boundary so violations fail loudly at the source.
- **Avoid redundant tests already covered elsewhere.** Do not add tests for code patterns already guaranteed by TypeScript or linting, and do not duplicate coverage that already exists in Storybook `play` functions or Playwright tests.
- **Test contracts (including side effects), not private implementation details.** It is valid to assert side effects when they are part of the public contract. Avoid assertions about internals that are not part of an exported contract, user-visible DOM output, or externally observable behavior.
- **Bias toward broader coverage for security and migrations.** For security-sensitive code paths and legacy data migration logic, prefer handling more edge cases and documenting evidence for the chosen safeguards. Migration compatibility code should be explicitly version-scoped so it can be removed once the support window ends.
- **Prefer deletion and simplicity over speculative generality.** No abstraction, fallback, or "flexibility" for a consumer or scenario that does not exist in this codebase today. If a change adds many lines, check whether the right change removes them.
- **Don't commit accidental overrides to generated code.** Files like `code/core/src/manager/globals/exports.ts` are auto-generated, as stated in their JSDoc header. Only commit changes if they match changes you made on your PR, otherwise leave them untouched and flag flaky generated files in the PR description.

## Comments and JSDoc

Code should be self-explanatory. A comment is only justified when the code cannot explain itself (a non-obvious *why*) or when a public API needs explanation. Never comment to record that you did x, y, z.

Before writing or editing any code file, read [`.agents/guidelines/comments-and-jsdoc.md`](.agents/guidelines/comments-and-jsdoc.md) and follow it. Read it once per session, not once per file.

## Maintenance Rules For Agents

- Use this file as the canonical instruction source
- Update `AGENTS.md` when architecture, commands, versions, release flows, or contributor guidance changes
- Keep `CLAUDE.md` and other agent entrypoints as thin references to `AGENTS.md`
- Do not reintroduce duplicated instruction files when a reference will do
