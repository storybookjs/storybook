# Architecture

This document is canonical for repo structure and architecture: renderer vs builder vs framework, the core package layout, key flows, open services and toolsets, and agent-facing skills. `AGENTS.md` owns the pointer to this file and the kickstart commands.

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

## Renderer vs builder vs framework

| Concept   | Role                                  | Example                   |
| --------- | ------------------------------------- | ------------------------- |
| Renderer  | Mounts UI framework to the DOM        | `@storybook/react`        |
| Builder   | Bundles and serves Storybook          | `@storybook/builder-vite` |
| Framework | Renderer + builder + framework config | `@storybook/react-vite`   |

## Core package

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
- `storybook/internal/tools` — Node SDK for `storybook tools` (`createTools`)

## Key flow

- `.storybook/main.ts` is loaded at startup
- `.storybook/preview.ts` is bundled into preview (TSX for React-based frameworks)
- `.storybook/manager.ts` is bundled into manager
- `*.stories.*` files are indexed by AST before runtime
- Story selection loads the module, prepares the story, and renders it

AST indexing keeps the sidebar fast and prevents one broken story file from breaking the whole UI.

## Open services and toolsets

- Open services own internal state, synchronization, queries, commands, and loading. Toolsets expose
  capabilities to agents through MCP and the `storybook tools` CLI.
- Definitions live under `code/core/src/shared/open-service/`; addons may own and register their own
  toolsets, as addon-vitest does for `test`.
- Register services and toolsets from the same `services` preset hook and behind the same feature
  gate. Missing or duplicate registrations fail loudly.
- The tools CLI consumes `storybook/internal/tools` (`createTools`). Default mode is
  attach-preferred (`auto`): join a running instance as a delegated leaf, or load locally on gate
  failure. `--attach` requires attachment; `--no-attach` forces local. When several running
  instances match the project, attach picks the invoking agent's most recently started one and
  warns on stderr; `-p, --port` targets a specific instance. Local `createTools` never
  `chdir`s: a foreign `cwd` starts a project-local child host.
- Read `code/core/src/shared/open-service/README.md` before changing the contract, adapters,
  registration, docs access, or transport rendering. Read `code/core/src/cli/tools/README.md` and
  `code/core/src/cli/tools/architecture.md` before changing attachment, the SDK, or the tools CLI.

## Agent-facing skills

- `storybook skills` serves the `stories`, `write-story`, and `setup` documents as Markdown.
- Pure content lives in `code/core/src/cli/skills/content/` and is exported through
  `storybook/internal/skills`; addon-mcp consumes the same builders.
- Keep `cli/skills/**` independent of `cli/ai/**`, and keep `cli/skills/content/**` independent of
  `core-server`. Lint rules enforce both boundaries.
