# Storybook Agent Instructions

Storybook is a large TypeScript monorepo. The git root is the repo root, the main code lives in `code/`, and build tooling lives in `scripts/`.

- **Base branch**: `next` (all PRs should target `next`, not `main`)
- **Node.js**: `22.21.1` (see `.nvmrc`)
- **Package Manager**: Yarn Berry
- **Task orchestration**: NX plus the custom `yarn task` runner
- **CI environment**: Linux and Windows

## Skills

Detailed instructions are split into skills for progressive disclosure. Use the relevant skill when you need deeper context:

- **storybook-architecture** — Repo structure, renderer/builder/framework concepts, core package layout, key flow
- **storybook-commands** — Build, compile, lint, typecheck, test commands, NX and `yarn task` usage
- **storybook-sandbox** — Sandbox generation, templates, paths, E2E and test-runner flows
- **storybook-development-workflow** — Standard workflow for code changes, testing expectations, quality and logging rules
- **storybook-troubleshooting** — Common fixes, environment variables, debugging tips

## Maintenance Rules

- Update skills in `.agents/skills/` when architecture, commands, versions, or contributor guidance changes
- Keep `AGENTS.md` as a thin entry point — detailed content belongs in skills
- Keep `CLAUDE.md` and other agent entrypoints as thin references to `AGENTS.md`
