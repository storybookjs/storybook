# Storybook Architecture Guide

## Overview

TypeScript monorepo supporting 14+ frameworks. Root at git root, code in `code/`, tooling in `scripts/`.

| Key             | Value       |
| --------------- | ----------- |
| Node            | 22.21.1     |
| Package Manager | Yarn 4.9.1  |
| Bundler         | ESBuild     |
| Task Runner     | NX + custom |

## Directory Structure

```
storybook/
├── code/
│   ├── core/           # Main package (published as "storybook")
│   ├── addons/         # a11y, docs, links, onboarding, pseudo-states, themes, vitest
│   ├── builders/       # builder-vite, builder-webpack5
│   ├── renderers/      # react, vue3, svelte, preact, html, web-components, server
│   ├── frameworks/     # react-vite, nextjs, vue3-vite, angular, sveltekit, etc.
│   ├── lib/            # cli-storybook, create-storybook, codemod, csf-plugin
│   └── .storybook/     # Internal UI config
├── scripts/
│   ├── tasks/          # Task definitions
│   ├── build/          # ESBuild bundling
│   └── sandbox/        # Sandbox generation
└── docs/
```

## Core Package (`code/core/src/`)

```
├── core-server/     # Dev server, static build, presets
├── manager/         # React UI (sidebar, canvas)
├── manager-api/     # State management (14 modules)
├── preview/         # Preview iframe entry point
├── preview-api/     # Story rendering, hooks, store
├── channels/        # Manager↔Preview communication (postmessage, websocket)
├── csf-tools/       # CSF parsing, vitest-plugin
├── common/          # Shared Node.js utilities
├── telemetry/       # Analytics
├── theming/         # Emotion-based theming
├── test/            # Testing utilities (expect, userEvent, fn)
├── instrumenter/    # Interaction testing instrumentation
├── shared/universal-store/  # Cross-environment state sync
└── actions, backgrounds, controls, ...  # Essential addons (bundled)
```

**Exports:**

- Public: `storybook/actions`, `storybook/preview-api`, `storybook/manager-api`, `storybook/theming`, `storybook/test`
- Internal: `storybook/internal/core-server`, `storybook/internal/csf-tools`, `storybook/internal/common`, `storybook/internal/channels`

**Full documentation:** See [code/core/CONTRIBUTING.md](code/core/CONTRIBUTING.md)

## Architecture Concepts

### Renderer vs Framework vs Builder

| Concept       | What it does                    | Example                   |
| ------------- | ------------------------------- | ------------------------- |
| **Renderer**  | Mounts UI framework to DOM      | `@storybook/react`        |
| **Builder**   | Bundles & serves (Vite/Webpack) | `@storybook/builder-vite` |
| **Framework** | Renderer + Builder + config     | `@storybook/react-vite`   |

### Preset System

Resolution chain: User config → Framework → Builder → Addons → Core defaults

Config hooks: `viteFinal(config)`, `webpackFinal(config)`

### Channel Communication

```
Manager UI ←─PostMessage─→ Preview Iframe
     ↓ WebSocket
Dev Server
```

### User Files Processing

```
.storybook/
├── main.ts      → Loaded at startup, configures everything
├── preview.ts   → Bundled into preview, provides decorators/parameters
└── manager.ts   → Bundled into manager, registers addon UI

src/*.stories.tsx → Indexed via AST (no execution), then imported at runtime
```

**Processing flow:**
1. **Startup:** `main.ts` → `loadMainConfig()` → `{ stories, addons, framework }`
2. **Indexing:** stories glob → csf-tools AST parse → `/index.json` (sidebar)
3. **Manager bundle:** `manager.ts` + addon manager entries → UI with sidebar
4. **Preview bundle:** `preview.ts` + story imports → rendering
5. **Runtime:** index.json lookup → `import(story)` → `prepareStory()` → render

**Why AST indexing?** Sidebar appears instantly, syntax errors don't break UI, stats available without execution.

### Addons

Two-part architecture:

- **Preview side** (iframe): decorators, parameters, afterEach
- **Manager side** (UI): panels, tools, tabs via `addons.register()`

### Test Utilities (`storybook/test`)

```typescript
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
```

Instrumented for step-through debugging in interaction tests.

### Core Events (channel)

Key events: `STORY_SPECIFIED`, `STORY_PREPARED`, `STORY_RENDERED`, `STORY_FINISHED`, `UPDATE_STORY_ARGS`, `STORY_ARGS_UPDATED`, `UPDATE_GLOBALS`, `GLOBALS_UPDATED`, `STORY_INDEX_INVALIDATED`, `SET_INDEX`

---

## Indexer System

**Location:** `code/core/src/types/modules/indexer.ts` + `code/core/src/csf-tools/CsfFile.ts`

An indexer extracts story metadata from files **without executing them** - enables sidebar/index at startup.

```typescript
type Indexer = {
  test: RegExp; // Which files to process
  createIndex: (fileName: string, options: IndexerOptions) => Promise<IndexInput[]>;
};

// Default CSF indexer (from common-preset.ts)
const csfIndexer: Indexer = {
  test: /(stories|story)\.(m?js|ts)x?$/,
  createIndex: async (fileName, options) => (await readCsf(fileName, options)).parse().indexInputs,
};
```

**What it extracts (IndexInput):**

```typescript
interface IndexInput {
  type: 'story' | 'docs';
  exportName: string; // "Primary"
  title?: string; // "Components/Button"
  name?: string; // Auto-generated from exportName
  tags?: string[];
  rawComponentPath?: string; // "./Button.tsx"
  __stats?: {
    play?: boolean;
    loaders?: boolean;
    render?: boolean;
    factory?: boolean; // CSF4 factory pattern
  };
}
```

**Workflow:**

1. `StoryIndexGenerator` finds story files via glob
2. Matches indexer via `test` regex
3. Calls `createIndex()` → metadata
4. Builds `StoryIndex` (served at `/index.json`)

---

## Renderers

**Location:** `code/renderers/{name}/`

A renderer knows **how to mount a specific UI framework** to the DOM.

**Key functions:**

```typescript
// 1. render(args, context) - Convert args to element
export const render: ArgsStoryFn<ReactRenderer> = (args, context) => {
  const { component: Component } = context;
  return <Component {...args} />;
};

// 2. mount(context) - Mount element to DOM
export const mount = (context: StoryContext) => async (ui) => {
  if (ui != null) {
    context.originalStoryFn = () => ui;
  }
  await context.renderToCanvas();
  return context.canvas;
};

// 3. renderToCanvas - Actual DOM rendering
export async function renderToCanvas(renderContext, canvasElement) {
  const { renderElement, unmountElement } = await import('@storybook/react-dom-shim');
  const content = (
    <ErrorBoundary>
      <Story {...storyContext} />
    </ErrorBoundary>
  );
  await act(async () => {
    await renderElement(content, canvasElement);
  });
  return async () => unmountElement(canvasElement);
}
```

**Render lifecycle phases:**

```
preparing → loading → beforeEach → rendering → playing → played → completing → completed → afterEach → finished
                                       ↓           ↓
                                  story.mount()  play()
```

Also: `aborted`, `errored`

**Manager API modules:** stories, refs, globals, layout, addons, shortcuts, notifications, url, version, whatsnew, settings, channel, provider, openInEditor

---

## Builders

**Location:** `code/builders/`

A builder **bundles and serves** Storybook's preview.

```typescript
interface Builder<Config, Stats> {
  getConfig(options): Promise<Config>;
  start({ router, channel }): Promise<{ bail(): Promise<void> }>;
  build({ options }): Promise<Stats>;
  bail(): Promise<void>;
}
```

| Aspect      | Vite             | Webpack                |
| ----------- | ---------------- | ---------------------- |
| Dev server  | Native Vite      | webpack-dev-middleware |
| HMR         | Built-in         | webpack-hot-middleware |
| Build speed | Fast (ESM-first) | Slower (full bundle)   |
| Config hook | `viteFinal`      | `webpackFinal`         |

**Key Vite plugins:** `codeGeneratorPlugin`, `csfPlugin`, `stripStoryHMRBoundary`

---

## Frameworks

**Location:** `code/frameworks/{name}/`

A framework = renderer + builder + framework-specific config.

**Composition pattern:**

```typescript
// code/frameworks/react-vite/src/preset.ts
export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/react/preset'),
};

export const viteFinal = async (config) => {
  return { ...config, plugins: [...config.plugins, reactDocgen()] };
};
```

**Composition flow:**

```
framework: '@storybook/react-vite'
    ↓
Load react-vite/preset.ts
    ↓
core: { builder: 'builder-vite', renderer: 'react/preset' }
    ↓
Load builder-vite preset → Load react preset
    ↓
Apply viteFinal hooks (each layer can modify)
    ↓
Final Vite config with React support
```

**Complex framework example (Next.js):**

```typescript
export const core = async (config, options) => {
  await configureConfig({ ... });  // Configure Next.js BEFORE webpack
  return {
    builder: '@storybook/builder-webpack5',
    renderer: '@storybook/react/preset',
  };
};

export const webpackFinal = async (baseConfig) => {
  // Configure: SWC, fonts, CSS, images, styled-jsx
  return baseConfig;
};
```

---

## Task Runner (`scripts/task.ts`)

```bash
yarn task <task> [--template <key>] [--start-from auto|task|<task-name>]
```

**Monorepo tasks:**
| Task | Purpose |
|------|---------|
| `install` | Install deps |
| `compile` | Compile packages |
| `check` | TypeScript check |
| `publish` | Publish to verdaccio |
| `run-registry` | Local npm registry (6001/6002) |

**Sandbox tasks** (require `--template`):
| Task | Purpose |
|------|---------|
| `sandbox` | Create sandbox |
| `dev` | Dev server (6006) |
| `build` | Production build |
| `e2e-tests-dev` | Playwright tests |
| `smoke-test` | Basic tests |

**`--start-from` values:**
| Value | Behavior |
|-------|----------|
| `auto` | Skip ready tasks (CI default) |
| `task` | Only run final task |
| `<task-name>` | Rebuild from that task |

**Link vs No-Link:**
| Mode | Flow | Use case |
|------|------|----------|
| `--link` | compile → symlink | Fast local dev |
| `--no-link` | compile → verdaccio → install | CI, reproducing issues |

**yarn task vs NX equivalents:**
```bash
# Compilation
yarn task compile --no-link
yarn nx run-many -t compile -c production

# E2E tests
yarn task e2e-tests-dev --template react-vite/default-ts --start-from auto --no-link
yarn nx e2e-tests-dev react-vite/default-ts -c production

# Skip dependencies
yarn task e2e-tests-dev --start-from e2e-tests --template react-vite/default-ts
yarn nx e2e-tests-dev -c production --exclude-task-dependencies
```

**NX notes:** `-c production` required for sandbox commands. NX project names = npm name without `@storybook/`.

---

## Sandbox Templates

**Location:** `code/lib/cli-storybook/src/sandbox-templates.ts`

Single source of truth for framework combinations:

```typescript
'react-vite/default-ts': {
  name: 'React Latest (Vite | TypeScript)',
  script: 'npm create vite --yes {{beforeDir}} -- --template react-ts',
  expected: {
    framework: '@storybook/react-vite',
    renderer: '@storybook/react',
    builder: '@storybook/builder-vite',
  },
  skipTasks: ['bench'],
  modifications: { useCsfFactory: true },
}
```

**Common templates:** `react-vite/default-ts`, `nextjs/default-ts`, `vue3-vite/default-ts`, `angular-cli/default-ts`

**Sandboxes location:** `../storybook-sandboxes/` (outside repo)

---

## Common Commands

```bash
# Setup
yarn && yarn nx run-many -t compile -c production

# Development
cd code && yarn storybook:ui          # UI dev server
yarn nx compile react -c production   # Compile one package

# Testing
cd code && yarn test                  # Unit tests
yarn task e2e-tests-dev --template react-vite/default-ts

# Sandbox
yarn task sandbox --template react-vite/default-ts
```

## Commands to Avoid

| Command | Why |
|---------|-----|
| `yarn task dev` | Runs indefinitely, never terminates |
| `yarn start` | Also runs indefinitely |

## Code Quality

```bash
yarn prettier --write <file>
yarn lint:js:cmd <file>
```

**Logging:** Use `storybook/internal/node-logger` (server) or `storybook/internal/client-logger` (browser), never `console.log`

## Key Locations

| Topic             | Location                                          |
| ----------------- | ------------------------------------------------- |
| CLI               | `code/lib/cli-storybook/src/`                     |
| Framework presets | `code/frameworks/{name}/src/preset.ts`            |
| Renderer mounting | `code/renderers/{name}/src/render.tsx`            |
| CSF parsing       | `code/core/src/csf-tools/`                        |
| Task definitions  | `scripts/tasks/`                                  |
| Sandbox templates | `code/lib/cli-storybook/src/sandbox-templates.ts` |

## Detailed Documentation

| Topic | README |
|-------|--------|
| Core package | [code/core/CONTRIBUTING.md](code/core/CONTRIBUTING.md) |
| Scripts & tasks | [scripts/CONTRIBUTING.md](scripts/CONTRIBUTING.md) |
| Release scripts | [scripts/release/CONTRIBUTING.md](scripts/release/CONTRIBUTING.md) |

## Important Notes

1. Sandboxes at `../storybook-sandboxes/`, not in repo
2. NX project names = npm name without `@storybook/` (e.g., `react`)
3. Always compile before testing changes
4. `--no-link` to reproduce CI failures

## Environment Variables

| Variable                    | Purpose                      |
| --------------------------- | ---------------------------- |
| `DEBUG=true`                | Vitest debug + Playwright UI |
| `STORYBOOK_TELEMETRY_DEBUG` | Log telemetry                |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build failures | `yarn && yarn nx run-many -t compile -c production` |
| Port 6006 in use | Kill process or use different port |
| Memory issues | Increase Node.js memory limit |
| Sandbox not found | Check `../storybook-sandboxes/`, not `./sandbox` |

**Debug flags:** `--debug` for verbose CLI output, check `.cache/` for build artifacts.

## Timeout Guidance (for AI agents)

| Operation | Timeout |
|-----------|---------|
| Short commands | 120s (default) |
| `yarn install` | 300s |
| Compilation | 300s |
| Linting | 300s |
| Dev servers | Run async/background |
