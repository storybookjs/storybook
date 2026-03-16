# Storybook Agent Instructions

Keep this file, `AGENTS.md`, up to date when Storybook's architecture, tooling, workflows, or contributor guidance changes.

This file is the canonical instruction source for coding agents. Files like `CLAUDE.md` should point here instead of duplicating instructions.

## Repository Overview

Storybook is a large TypeScript monorepo. The git root is the repo root, the main code lives in `code/`, and build tooling lives in `scripts/`.

- **Node.js**: `22.21.1` (see `.nvmrc`)
- **Package Manager**: Yarn Berry
- **Task orchestration**: NX plus the custom `yarn task` runner
- **CI environment**: Linux and Windows

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
- `.storybook/preview.ts` is bundled into preview
- `.storybook/manager.ts` is bundled into manager
- `*.stories.*` files are indexed by AST before runtime
- Story selection loads the module, prepares the story, and renders it

AST indexing keeps the sidebar fast and prevents one broken story file from breaking the whole UI.

## Common Commands

Run commands from the repository root unless stated otherwise.

For routine agent work, prefer the faster non-production commands first. Add `-c production` only when you need sandbox-related NX tasks or you are explicitly matching CI behavior.

### Install and compile

```bash
yarn
yarn task compile
yarn nx run-many -t compile
yarn nx compile <package-name>
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
cd code && yarn test
cd code && yarn test:watch
cd code && yarn storybook:vitest
```

### Common task scenarios

| Scenario                        | Command                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Compile everything quickly      | `yarn nx run-many -t compile`                                                  |
| Compile one package             | `yarn nx compile <package-name>`                                               |
| Check TypeScript errors quickly | `yarn nx run-many -t check`                                                    |
| Start the internal Storybook UI | `cd code && yarn storybook:ui`                                                 |
| Build the internal Storybook UI | `cd code && yarn storybook:ui:build`                                           |
| Run unit tests                  | `cd code && yarn test`                                                         |
| Run Storybook Vitest tests      | `cd code && yarn storybook:vitest`                                             |
| Generate a sandbox              | `yarn task sandbox --template react-vite/default-ts --start-from auto`         |
| Run sandbox E2E tests           | `yarn task e2e-tests-dev --template react-vite/default-ts --start-from auto`   |
| Run sandbox test-runner tests   | `yarn task test-runner-dev --template react-vite/default-ts --start-from auto` |

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

- Use `cd code && yarn test` for unit tests
- Use Storybook UI or Chromatic for visual validation
- Use `yarn task e2e-tests --start-from auto` or `yarn task e2e-tests-dev --start-from auto` for E2E coverage
- Use `yarn task test-runner --start-from auto` or `yarn task test-runner-dev --start-from auto` for test-runner scenarios
- Use `yarn task smoke-test --start-from auto` for smoke checks

Watch-mode commands:

```bash
cd code && yarn test:watch
yarn affected:test
cd code && yarn storybook:vitest
```

When writing tests:

- Export functions that need direct tests
- Test real behavior, not just syntax patterns
- Use coverage when useful: `yarn vitest run --coverage <test-file>`
- Mock external dependencies like file system access and loggers

## Quality and Logging

After changing files:

1. Format with `yarn prettier --write <file>`
2. Lint with `yarn --cwd code lint:js:cmd <file-relative-to-code-folder> --fix` or `cd code && yarn lint:js:cmd <file-relative-to-code-folder>`
3. Run relevant tests before submitting a PR

Use Storybook loggers instead of raw `console.*` in normal code paths:

- Server-side: `storybook/internal/node-logger`
- Client-side: `storybook/internal/client-logger`

Avoid `console.log`, `console.warn`, and `console.error` unless the file is isolated enough that importing the logger is not reasonable.

## Troubleshooting

- Build failures are often fixed by rerunning `yarn` and `yarn nx run-many -t compile`
- Storybook UI uses port `6006` by default
- Large compiles may require more Node.js memory
- Sandbox paths are `../storybook-sandboxes/`, not `./sandbox` or `code/sandbox/`
- Use `--debug` for verbose CLI output
- Check generated sandbox directories and `.cache/` for build artifacts

## Environment Variables

| Variable                      | Purpose                     |
| ----------------------------- | --------------------------- |
| `IN_STORYBOOK_SANDBOX`        | Set during sandbox creation |
| `STORYBOOK_DISABLE_TELEMETRY` | Disable telemetry           |
| `STORYBOOK_TELEMETRY_DEBUG`   | Log telemetry events        |
| `DEBUG`                       | Enable debug logging        |

## Commands To Avoid

- **DO NOT RUN** `yarn task dev` without an explicit sandbox template
- **DO NOT RUN** `yarn start`

These usually start long-running development servers and are the wrong default for agents.

## Maintenance Rules For Agents

- Use this file as the canonical instruction source
- Update `AGENTS.md` when architecture, commands, versions, release flows, or contributor guidance changes
- Keep `CLAUDE.md` and other agent entrypoints as thin references to `AGENTS.md`
- Do not reintroduce duplicated instruction files when a reference will do
