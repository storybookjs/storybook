# Storybook Agent Instructions

Keep this file, `AGENTS.md`, up to date when Storybook's architecture, tooling, workflows, or contributor guidance changes.

This file is the canonical instruction source for coding agents. Files like `CLAUDE.md` should point here instead of duplicating instructions.

## Repository Overview

Storybook is a large TypeScript monorepo. The git root is the repo root, the main code lives in `code/`, and build tooling lives in `scripts/`.

- **Node.js**: `22.21.1` (see `.nvmrc`)
- **Package Manager**: Yarn Berry
- **Task orchestration**: NX
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

For routine agent work, prefer the faster non-production commands first. Add `-c production` only when you need CI-parity behavior (it adds `--prod` to compile steps).

### Common task scenarios

| Scenario                        | Command                                                                 |
| ------------------------------- | ----------------------------------------------------------------------- |
| Install dependencies            | `yarn`                                                                  |
| Compile everything quickly      | `yarn nx run-many -t compile`                                           |
| Compile one package             | `yarn nx compile <package-name>`                                        |
| Lint a specific file            | `yarn nx run code:lint-js <file-relative-to-code-folder> --cache --fix` |
| Check TypeScript errors quickly | `yarn nx run-many -t check`                                             |
| Start the internal Storybook UI | `cd code && yarn storybook:ui`                                          |
| Build the internal Storybook UI | `cd code && yarn storybook:ui:build`                                    |
| Run unit tests                  | `cd code && yarn test`                                                  |
| Run unit tests in watch mode    | `cd code && yarn test:watch`                                            |
| Run Storybook Vitest tests      | `cd code && yarn storybook:vitest`                                      |
| Generate a sandbox              | `yarn nx sandbox react-vite/default-ts`                                 |
| Run a sandbox Storybook UI      | `yarn nx dev react-vite/default-ts`                                     |
| Run sandbox E2E tests           | `yarn nx e2e-tests-dev react-vite/default-ts`                           |
| Run sandbox test-runner tests   | `yarn nx test-runner-dev react-vite/default-ts`                         |

## NX

Use NX when you want better caching and dependency tracking. Prefer these faster defaults first, and only add `-c production` or `--no-link` when you specifically need sandbox parity or CI-like behavior. Use the NX MCP graph to understand task dependencies and what will be affected by each command.

```bash
# Compile all packages
yarn nx run-many -t compile

# Check all packages (depends on ALL packages compiling first)
yarn nx run-many -t check

# Run E2E tests for a template (triggers full sandbox chain: compile → publish → registry → sandbox → dev)
yarn nx e2e-tests-dev react-vite/default-ts

# Skip dependency chain (only if you've already run the prerequisite steps manually)
yarn nx e2e-tests-dev --exclude-task-dependencies
```

Key points:

- `react-vite/default-ts` is the default sandbox template (`defaultProject` in `nx.json`)
- `-c production` adds `--prod` to compile steps for CI-parity but is not required for sandbox commands to work
- `check`, `test`, and `lint-js` all depend on `{ projects: ["*"], target: "compile" }` — running them via NX will first compile ALL packages
- NX handles task dependencies via `nx.json`

## Sandbox Notes

Sandboxes are generated outside the repository at `../storybook-sandboxes/` by default.

- `STORYBOOK_SANDBOX_ROOT=./sandbox` forces local output, but is usually not preferred
- `./sandbox` inside the repo mainly exists for NX outputs, not CI sandboxes

Sandbox dependency chain: `*:compile` → `scripts:publish` → `scripts:run-registry` → `sandbox` → `prepare-sandbox` → `dev`/`build`/etc. This is a heavy operation. If sandbox generation fails, fall back to `cd code && yarn storybook:ui`.

Common templates:

- `react-vite/default-ts`
- `react-webpack/default-ts`
- `angular-cli/default-ts`
- `svelte-vite/default-ts`
- `vue3-vite/default-ts`
- `nextjs/default-ts`

### Propagating local changes to an existing sandbox

Use the sandbox-rebuild skill (.agents/skills/sandbox-rebuild) to copy compiled output from a local package into an existing sandbox without regenerating the whole sandbox.

## How To Work In This Repo

### For normal code changes

1. Install if needed: `yarn`
2. Compile with NX: `yarn nx run-many -t compile`
3. Make changes
4. Recompile affected packages
5. Validate there are no TypeScript errors with `yarn nx run-many -t check`
6. Run `yarn nx run code:test --changed`
7. Run `yarn nx run code:lint-js <path-relative-to-code-folder-of-changed-files> --cache --fix`
8. Validate behavior in the internal Storybook UI first, then switch to sandbox or `-c production` flows only if you need template or CI parity

### For addon, framework, or renderer work

1. Edit the relevant package under `code/addons/`, `code/frameworks/`, or `code/renderers/`
2. Recompile with NX, starting without `-c production`
3. Generate a matching sandbox
4. Run the relevant test-runner, E2E, or Storybook UI validation flow

When writing tests:

- Export functions that need direct tests
- Test real behavior, not just syntax patterns
- Use coverage when useful: `yarn vitest run --coverage <test-file>`
- Mock external dependencies like file system access and loggers

## Quality and Logging

Use Storybook loggers instead of raw `console.*` in normal code paths:

- Server-side: `storybook/internal/node-logger`
- Client-side: `storybook/internal/client-logger`

Avoid `console.log`, `console.warn`, and `console.error` unless the file is isolated enough that importing the logger is not reasonable.

## Troubleshooting

- Build failures are often fixed by rerunning `yarn` and `yarn nx run-many -t compile`
- Storybook UI uses port `6006` by default
- Large compiles may require more Node.js memory
- Sandbox paths are `../storybook-sandboxes/`, not `./sandbox` or `code/sandbox/`
- If `scripts:publish` fails with `Error: No process running on port` (from `kill-port`), rerun the sandbox flow or run Storybook directly from the sandbox directory.
- If running Storybook in a sandbox fails with `EPERM` creating `node_modules/.cache/...`, ensure the sandbox directory is writable (agents may need escalated permissions).
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

## Shell Pitfalls

- **Interactive prompts:** Common shell aliases (e.g. `cp -i`, `mv -i`, `rm -i`) will block agents waiting for confirmation. Always use the full binary path (`/bin/cp`, `/bin/mv`, `/bin/rm`) to bypass aliases and ensure non-interactive execution.

## Maintenance Rules For Agents

- Use this file as the canonical instruction source
- Update `AGENTS.md` when architecture, commands, versions, release flows, or contributor guidance changes
- Keep `CLAUDE.md` and other agent entrypoints as thin references to `AGENTS.md`
- Do not reintroduce duplicated instruction files when a reference will do

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors

<!-- nx configuration end-->
