# Architecture

This document is canonical for repo structure and architecture: renderer vs builder vs framework, the five-package layout, key flows, open services and toolsets, and agent-facing skills. `AGENTS.md` owns the pointer to this file.

## Repository Structure

```text
storybook/
├── .github/                      # GitHub configs and workflows
├── .nx/                          # NX workflow state
├── code/                         # Main codebase
│   ├── .storybook/               # Internal Storybook UI config
│   ├── core/                     # @storybook/core: instance, runtime, types, Node utilities
│   ├── addons/                   # Core addons
│   ├── builders/                 # Builder integrations
│   ├── renderers/                # Renderer integrations
│   ├── frameworks/               # Framework integrations
│   ├── lib/                      # Supporting libraries
│   │   ├── ui/                   # @storybook/ui: components and theming
│   │   ├── manager/              # @storybook/manager: manager app, manager API, router, manager builder
│   │   ├── open-service/         # @storybook/open-service: tools SDK client (createTools)
│   │   └── storybook/            # storybook: server, CLI, built-in features, public entries
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

Frameworks, renderers, and builders are native `defineFramework`, `defineRenderer`, and `defineBuilder` plugins exported as the default export of `<pkg>/node`.
Core resolves them from the `main.ts` strings (`framework: '@storybook/react-vite'` or `{ name, options }`) through `resolveNativeFactory`.
String addons in `main.ts` load `<pkg>/node` the same way when the package has one.
Official packages ship no preset; `resolveNativeFactory` maps their old `<pkg>/preset*` and `<pkg>/server/framework-preset-*` specifiers to `<pkg>/node` with a deprecation warning, and the compat preset loader does the same for entries nested in third-party presets.
Renderers keep `./preset` as an exact alias of `./node`, because third-party frameworks still resolve `<renderer>/preset`.
`scripts/check/check-no-preset.ts` (run by `scripts/check/check-package.ts`) fails when an official package ships any other preset.
`scripts/check/check-no-presets-apply.ts`, run the same way, fails on `presets.apply` outside the compat layer; call `storybook.callHook` instead.
Legacy presets (`<pkg>/preset`) remain for third-party packages that have no native entry; core bridges them with `legacyPreset`.

## Core packages

Storybook ships as five packages.
Four are layered with one import direction, `core <- ui <- manager <- storybook`: a package imports only itself and the packages to its left.
The fifth, `@storybook/open-service`, sits beside them and imports only `@storybook/core/*`, so it installs without `storybook`.

| Package                   | Directory               | Rules                                                                     |
| ------------------------- | ----------------------- | ------------------------------------------------------------------------- |
| `@storybook/core`         | `code/core`             | [code/core/README.md](../../code/core/README.md)                          |
| `@storybook/ui`           | `code/lib/ui`           | [code/lib/ui/README.md](../../code/lib/ui/README.md)                      |
| `@storybook/manager`      | `code/lib/manager`      | [code/lib/manager/README.md](../../code/lib/manager/README.md)            |
| `storybook`               | `code/lib/storybook`    | [code/lib/storybook/README.md](../../code/lib/storybook/README.md)        |
| `@storybook/open-service` | `code/lib/open-service` | [code/lib/open-service/README.md](../../code/lib/open-service/README.md)  |

Each package README owns that package's contents, import rules, and entries.

### Cross-package rules

- User projects import only `storybook/*`.
- Never import `@storybook/ui` or `@storybook/manager` from outside the layered packages.
  `local-rules/storybook-monorepo-imports` and `scripts/check/check-runtime-deps.ts` enforce it.
  The dist check allows `@storybook/core` only in packages that declare it.
- Official addons (`code/addons/*`) import their Node side (`node`, vitest plugin, services) from `@storybook/core/*` and depend on `@storybook/core` at `workspace:*`.
  They keep `storybook` a required peer, because their UI runs only inside a full Storybook.
- Addon postinstall scripts stay on `storybook/*`, because they run inside end-user CLIs.
- Frameworks, renderers, builders, and presets import their Node side (`node`, builder server code, docgen and indexers) from `@storybook/core/*`.
  They depend on `@storybook/core` at `workspace:*` and peer `storybook` as optional, so a project can run them with `@storybook/core` alone.
  Their browser side stays on `storybook/*`: the product's `preview-api` composes the built-in feature annotations, and their `definePreview` adds `storybook/internal/preview/built-in-annotations`.
- Product-owned entries stay on `storybook/*`: `storybook/internal/{server,skills,cli}`, `getPreviewSources` from `storybook/internal/preview-page`, and `createStorybook` from `storybook/internal/instance`.
  A package that needs one to run keeps `storybook` required (the Angular frameworks).
  Otherwise it imports the entry lazily and throws `StorybookPackageRequiredError` when `storybook` is missing (the builders' headless change detection).
- `storybook` keeps every `storybook/*` and `storybook/internal/*` export key as a shim that re-exports the lower package, for example `storybook/theming` re-exports `@storybook/ui/theming`.
- Lower packages expose the same subpaths under their own name (`@storybook/core/internal/types`, `@storybook/manager/manager-api`) plus deep entries at `<pkg>/internal/deep/<path>`.
  Core maps its uniform deep entries through one `./internal/deep/*` pattern (`deepExportsPattern` in its `build-config.ts`).
  `scripts/check/check-deep-imports.ts` fails on a deep import that no build entry builds.
- Side-effect entries are single built files listed in the `storybook` `sideEffects` array: `dist/core/csf`, `dist/core/preview-api`, `dist/core/preview/runtime`, and `dist/manager/ui/globals-runtime`.
- Augment types in the lowest package (`declare module '@storybook/core'` for `StorybookHooks`), not in the `storybook` shim.
- The public instance API (`createStorybook`, `define*`, `declareHooks`, the accessors, their types) is the root entry `@storybook/core`.
  Import it from there; use `@storybook/core/internal/instance` only for the legacy bridge and `internal_*` helpers.

### Instance, hooks, and server

- [Instance](../../code/core/src/instance/README.md): the instance API, the accessor, modes (`dev`, `build`, `headless`), the plugin model, and how official packages run without presets.
- [Hooks](../../code/core/src/instance/HOOKS.md): every hook needs a `declareHooks` strategy or an explicit kind; also the hook-interface pattern and its d.ts guard.
- [Server](../../code/lib/storybook/src/storybook/server/README.md): the preview host, screenshot transports, the toolset RPC host, the instance registry, and dev-server wiring.

### Where things live

- Instance, presets, and hooks: `code/core/src/instance/` and `code/core/src/common/presets.ts`; the built-in addon list and public instance entry are in `code/lib/storybook/src/features/index.ts` and `code/lib/storybook/src/storybook/instance.ts`.
  Called without options, core's `createStorybook` uses its own common plugin (`common-plugin.ts`) and only core-owned addons (docgen, story-docs), so a headless host needs no `storybook`; legacy presets still need the product's adapter and throw `LegacyAdapterMissingError` without it.
- Dev server, static build, and server presets: `code/lib/storybook/src/storybook/server/`.
- Preview page shared by the builders (`iframe.html`, generated preview modules, externals, defines, export order): `code/core/src/preview-page/`; the product's `getPreviewSources` adds its preview runtime path in `code/lib/storybook/src/storybook/preview-page.ts`.
- CLI and `storybook tools`: `code/lib/storybook/src/storybook/cli/` (tools CLI in `cli/tools/`; the SDK it drives in `code/lib/open-service/src/`).
- Open services: `code/core/src/shared/open-service/`.
- Manager app, manager API, router: `code/lib/manager/src/{ui,manager-api,router}/`; manager builder: `code/lib/manager/src/builder-manager/`.
- Components and theming: `code/lib/ui/src/{components,theming}/`.
- Preview, preview API, channels, csf-tools, common Node utilities: `code/core/src/{preview,preview-api,channels,csf-tools,common}/`.

Public exports include:

- `storybook` (`defineMain`, `defineAddon` and their types, for `main.ts`)
- `storybook/actions`
- `storybook/preview-api`
- `storybook/manager-api`
- `storybook/theming`
- `storybook/test`

Internal exports include:

- `storybook/internal/server`
- `storybook/internal/csf-tools`
- `storybook/internal/common`
- `storybook/internal/channels`
- `storybook/internal/tools` — deprecated re-export of `@storybook/open-service`, the Node SDK for `storybook tools` (`createTools`)

### Globals

The manager and preview bundles share runtime modules through globals instead of bundling a copy.
Each `globalsNameReferenceMap` names a `storybook/*` module and the global that holds it: manager in `code/lib/manager/src/ui/globals/globals.ts`, preview in `code/core/src/preview/globals/globals.ts`.
Next to it, `globalsPackageSpecifiers` maps each `storybook/*` key that only re-exports a lower package to that package's specifier, for example `storybook/manager-api` to `@storybook/manager/manager-api`.
The builders externalize both specifiers to the same global, so addons importing `storybook/*` and package code importing `@storybook/*` get one module instance:

- Preview: `builderGlobalsNameReferenceMap` (same file) merges both maps.
  The builders never read it directly: core's `getPreviewSources` (`code/core/src/preview-page/preview-sources.ts`) puts it in the `externals` it hands them.
  Pinned by `code/core/src/preview/globals/globals.test.ts`.
- Manager: `globalsModuleInfoMap` in `code/lib/manager/src/ui/globals/globals-module-info.ts` adds an entry per `globalsPackageSpecifiers` twin; the manager builder and `scripts/build/utils/generate-bundle.ts` use it. Pinned by `code/lib/manager/src/ui/globals/globals.test.ts`.

When adding a global, add the `storybook/*` key to `globalsNameReferenceMap` and, if a lower package owns the module, its specifier to `globalsPackageSpecifiers`.

## Key flow

- `.storybook/main.ts` is loaded at startup
- `.storybook/preview.ts` is bundled into preview (TSX for React-based frameworks)
- `.storybook/manager.ts` is bundled into manager
- `*.stories.*` files are indexed by AST before runtime
- Story selection loads the module, prepares the story, and renders it

AST indexing keeps the sidebar fast and prevents one broken story file from breaking the whole UI.

For AST mutations, use `CsfFile.objects()` for stories and `ConfigFile` directly for preview or main
configuration. Both expose `get`, `getValue`, `set`, `transform`, `remove`, `rename`, `move`, and `group`, with automatic
empty-parent cleanup. `set` accepts AST expressions and plain values, including nested arrays and objects.
`getValue` reads plain values statically; unresolved expressions produce diagnostics without executing code.
Use the file's `changed` and `mutationDiagnostics` to decide whether to write
the result. Named variable and function exports in config files share one logical root for these operations.
Use `ConfigFile.callArguments()` for object arguments to imported method calls such as
`addons.setConfig(...)`. Use `group(path, names)` when nesting sibling fields must preserve expression
evaluation order. Keep AST discovery, mutation, and safety checks in `csf-tools`; automigrations declare
the fields to change and provide migration-specific error guidance.

## Open services and toolsets

- Open services own internal state, synchronization, queries, commands, and loading.
- Toolsets expose capabilities to agents through MCP and the `storybook tools` CLI.
- Definitions live under `code/core/src/shared/open-service/`.
  Addons may own and register their own toolsets, as addon-vitest does for `test`.
- Register services and toolsets from the same `core:services:register` hook and behind the same feature gate.
  The legacy `services` preset hook still works.
  Missing or duplicate registrations fail loudly.
- The tools CLI drives `@storybook/open-service` (`createTools`) and picks its path before it loads `main.ts`.
- Toolset RPC: when the matching dev server's registry record advertises `toolsetRpc: 1`, the caller is a thin client.
  The dev server runs the handlers and records telemetry; the caller never loads the project configuration.
- Every other path loads the project in the caller, and it applies `services` too.
  On those paths only, subscriptions that execute commands start from `experimental_devServer`, not at registration, and `experimental_devServer` applies and awaits `services` first.

Read before changing:

- [Open-service README](../../code/core/src/shared/open-service/README.md): the contract, adapters, registration, docs access, transport rendering, and toolset RPC events.
- [Tools architecture](../../code/lib/storybook/src/storybook/cli/tools/architecture.md): the `storybook tools` flow, attach gates, the failure matrix, and telemetry.
- [Tools README](../../code/lib/storybook/src/storybook/cli/tools/README.md): flags and usage.
- [`@storybook/open-service` README](../../code/lib/open-service/README.md): the SDK (`createTools`).

### Docgen server

- `features.docgenServer` defaults to `true` when a renderer or framework contributes a docgen provider, and the main config overrides it.
  Today that is the React, Vue 3, and Web Components renderers and `@storybook/angular-vite`.
- Native renderers register a provider through `core:docgen-providers:collect` and a story-docs provider through `core:story-docs-provider:extend`.
  Legacy presets export `experimental_docgenProvider` and `experimental_storyDocsProvider` instead; do not add framework defaults or allowlists.
  A provider must not read `features.docgenServer`: only consumers gate on it.
- Svelte keeps its docgen provider unexported until it ships.
- The `docgen-server` automigration only renames `experimentalDocgenServer`; legacy React and Vue extractor settings are not preserved.
  Angular `compodoc: false` controls only the legacy Compodoc run and is not a server opt-out.

## Agent-facing skills

- `storybook skills` serves the `ui-workflow`, `component-docs`, `write-story`, and `setup` documents as Markdown.
- Pure content lives in `code/lib/storybook/src/storybook/cli/skills/content/` and is exported through
  `storybook/internal/skills`; addon-mcp consumes the same builders.
- Keep `cli/skills/content/**` independent of `server/`. A lint rule enforces the boundary.
