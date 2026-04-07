---
name: storybook-architecture
description: Use when navigating the Storybook monorepo structure, understanding renderer/builder/framework concepts, core package layout, or how stories are indexed and rendered
---

# Storybook Architecture

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

## Renderer vs Builder vs Framework

| Concept   | Role                                  | Example                   |
| --------- | ------------------------------------- | ------------------------- |
| Renderer  | Mounts UI framework to the DOM        | `@storybook/react`        |
| Builder   | Bundles and serves Storybook          | `@storybook/builder-vite` |
| Framework | Renderer + builder + framework config | `@storybook/react-vite`   |

## Core Package

The main package is `code/core/src/`. Key areas:

- `core-server/` — dev server, static build, presets
- `manager/` and `manager-api/` — Storybook UI
- `preview/` and `preview-api/` — story rendering
- `channels/` — manager ↔ preview communication
- `csf-tools/` — AST-based story indexing
- `common/` — shared Node.js utilities
- `test/` and `instrumenter/` — testing support

### Public exports

- `storybook/actions`, `storybook/preview-api`, `storybook/manager-api`, `storybook/theming`, `storybook/test`

### Internal exports

- `storybook/internal/core-server`, `storybook/internal/csf-tools`, `storybook/internal/common`, `storybook/internal/channels`

## Key Flow

1. `.storybook/main.ts` is loaded at startup
2. `.storybook/preview.ts` is bundled into preview (TSX for React-based frameworks)
3. `.storybook/manager.ts` is bundled into manager
4. `*.stories.*` files are indexed by AST before runtime
5. Story selection loads the module, prepares the story, and renders it

AST indexing keeps the sidebar fast and prevents one broken story file from breaking the whole UI.
