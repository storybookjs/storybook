# Storybook - Project Overview

## Purpose
Storybook is an open-source UI development tool for building, testing, and documenting UI components in isolation.
It supports multiple frontend frameworks (React, Vue, Angular, Svelte, Web Components, Preact, Ember, HTML, etc.)
and integrates with various build tools (Vite, Webpack5).

## Version
Current version: 10.2.x (as of March 2026)

## Tech Stack
- **Language**: TypeScript (strict mode), targeting ES2020
- **Package Manager**: Yarn 4.10.3 (with workspaces)
- **Node.js**: 22.21.1 (specified in `.nvmrc`)
- **Monorepo Tool**: NX (with `--no-cloud` flag required to avoid NX Cloud login issues)
- **Test Runner**: Vitest (primary), Playwright (E2E)
- **Linting**: ESLint 8
- **Formatting**: Prettier 3.7+
- **Bundlers**: Vite 7, Webpack 5, esbuild
- **UI Libraries**: React 18, react-aria (use specific submodules, not root imports)
- **Build System**: Custom build via `jiti ./scripts/build/build-package.ts`

## Repository Structure
```
storybook/
├── code/                   # Main codebase
│   ├── core/               # Core package (UI, API, manager, preview, server, etc.)
│   ├── addons/             # Official addons (docs, controls, a11y, interactions, vitest, etc.)
│   ├── builders/           # Build integrations (vite, webpack5, manager)
│   ├── frameworks/         # Framework integrations (react-vite, nextjs, angular, vue3-vite, etc.)
│   ├── renderers/          # Framework renderers (react, vue3, svelte, html, etc.)
│   ├── lib/                # Shared libraries (cli, codemod, csf-tools, etc.)
│   ├── presets/             # Preset packages
│   ├── e2e-tests/          # Playwright E2E tests
│   └── .storybook/         # Internal Storybook config (dogfooding)
├── scripts/                # Build/CI/task scripts
├── docs/                   # Documentation
├── sandbox/                # Generated sandbox environments for testing
└── test-storybooks/        # Test storybook configurations
```

## Key Packages
- `@storybook/core` - Core functionality (UI, API, server, preview, channels, etc.)
- `@storybook/react`, `@storybook/vue3`, etc. - Framework renderers
- `@storybook/react-vite`, `@storybook/nextjs`, etc. - Framework integrations
- `@storybook/addon-docs`, `@storybook/addon-a11y`, etc. - Official addons
- `storybook` - CLI package
- `create-storybook` - Project scaffolding
