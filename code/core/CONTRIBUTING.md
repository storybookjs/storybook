# Core Package (`storybook`)

The core package is the heart of Storybook, published as `storybook` on npm. It contains all the fundamental building blocks: the dev server, manager UI, preview rendering, channel communication, CSF parsing, telemetry, and more.

## Directory Structure

```
code/core/src/
├── core-server/       # Dev server, static build, preset system
├── manager/           # React UI (sidebar, toolbar, panels)
├── manager-api/       # Manager state management (14 modules)
├── preview/           # Preview iframe entry point
├── preview-api/       # Story rendering, hooks, store
├── channels/          # Manager ↔ Preview communication
├── csf-tools/         # AST parsing for indexing
├── common/            # Shared Node.js utilities
├── telemetry/         # Analytics and crash reporting
├── theming/           # Emotion-based theming system
├── test/              # Testing utilities (expect, userEvent)
├── instrumenter/      # Interaction testing instrumentation
├── types/             # TypeScript type definitions
├── core-events/       # Event constants for channel
├── shared/            # Code shared between manager/preview
│   └── universal-store/  # Cross-environment state sync
│
│   # Essential addons (bundled in core for zero-config)
├── actions/           # Actions addon (spy on callbacks)
├── backgrounds/       # Backgrounds addon
├── controls/          # Controls addon (args editor)
├── highlight/         # Highlight addon
├── measure/           # Measure addon
├── outline/           # Outline addon
├── toolbar/           # Toolbar shared components
├── viewport/          # Viewport addon
├── client-logger/     # Browser console logger
├── node-logger/       # Node.js console logger
└── bin/               # CLI entry points
```

## Exports

The package has two categories of exports:

**Public exports** (stable API):
```typescript
import { ... } from 'storybook/preview-api';    // Story hooks, composing
import { ... } from 'storybook/manager-api';    // Manager hooks, state
import { ... } from 'storybook/theming';        // styled, css, themes
import { ... } from 'storybook/test';           // expect, userEvent, fn
import { ... } from 'storybook/actions';        // action()
```

**Internal exports** (subject to change):
```typescript
import { ... } from 'storybook/internal/core-server';    // Server-side
import { ... } from 'storybook/internal/csf-tools';      // AST parsing
import { ... } from 'storybook/internal/common';         // Node utilities
import { ... } from 'storybook/internal/channels';       // Communication
import { ... } from 'storybook/internal/telemetry';      // Analytics
```

---

## Architecture Overview

Storybook runs as two separate applications that communicate via a channel:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER                                     │
│  ┌─────────────────────────────┐   ┌─────────────────────────────┐  │
│  │         MANAGER             │   │          PREVIEW            │  │
│  │  (React UI application)     │   │    (Story rendering)        │  │
│  │                             │   │                             │  │
│  │  - Sidebar                  │   │  - Renders stories          │  │
│  │  - Toolbar                  │   │  - Executes play functions  │  │
│  │  - Addons panels            │   │  - Manages args/globals     │  │
│  │  - Canvas wrapper           │   │                             │  │
│  │                             │   │                             │  │
│  │  Uses: manager-api          │◄──┼──► Uses: preview-api        │  │
│  └─────────────────────────────┘   └─────────────────────────────┘  │
│              │                               │                       │
│              └───────────┬───────────────────┘                       │
│                          │                                           │
│                    PostMessage                                       │
│                     Channel                                          │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                      WebSocket
                           │
┌──────────────────────────┼──────────────────────────────────────────┐
│                    DEV SERVER                                        │
│                                                                      │
│  - Loads .storybook/main.ts config                                   │
│  - Indexes *.stories.* files via AST (no execution)                  │
│  - Serves /index.json for sidebar                                    │
│  - Bundles preview with story imports + preview.ts                   │
│  - Bundles manager with addon manager entries                        │
│  - Watches for file changes, triggers re-index                       │
│                                                                      │
│  Uses: core-server, common, csf-tools                                │
└─────────────────────────────────────────────────────────────────────┘
```

### User Files and How They're Processed

```
.storybook/
├── main.ts          ─► Loaded at startup, configures everything
├── preview.ts       ─► Bundled into preview, provides decorators/parameters
└── manager.ts       ─► Bundled into manager, registers addon UI

src/
└── Button.stories.tsx  ─► Indexed via AST, then imported at runtime
```

**Processing flow:**

```
1. STARTUP
   main.ts ──► loadMainConfig() ──► { stories, addons, framework, ... }

2. INDEXING (happens without executing story files)
   stories glob ──► find *.stories.* ──► csf-tools AST parse ──► /index.json

   The indexer extracts from each file:
   - meta: { title, component, tags }
   - stories: [{ name, tags, __stats: { play, loaders, ... } }]

3. MANAGER BUNDLE
   manager.ts ──► addon manager entries ──► Manager UI with sidebar from index.json

4. PREVIEW BUNDLE
   preview.ts + story imports ──► Preview with renderToCanvas from renderer

5. RUNTIME (when story selected)
   index.json lookup ──► dynamic import(story file) ──► prepareStory() ──► render
```

**Why AST indexing?**
- The sidebar appears instantly (no story execution needed)
- Syntax errors in one file don't break the whole UI
- Stats like `hasPlayFunction` available before running stories

---

## Core Server (`core-server/`)

The server orchestrates Storybook startup, builds, and runtime.

### Entry Points

| File | Purpose |
|------|---------|
| `build-dev.ts` | `storybook dev` command |
| `build-static.ts` | `storybook build` command |
| `dev-server.ts` | HTTP server setup with Polka |
| `standalone.ts` | Programmatic API |

### Dev Server Flow

```typescript
// Simplified flow from build-dev.ts
async function buildDevStandalone(options) {
  // 1. Load main.js config
  const config = await loadMainConfig(options);

  // 2. Load presets (framework → builder → addons → core)
  const presets = await loadAllPresets({
    corePresets: [frameworkPreset, ...addonPresets],
    overridePresets: [commonOverridePreset],
  });

  // 3. Get builder from presets
  const { builder } = await presets.apply('core', {});
  const [previewBuilder, managerBuilder] = await Promise.all([
    getPreviewBuilder(builder),
    getManagerBuilder(),
  ]);

  // 4. Start dev server
  return storybookDevServer(options);
}
```

### Story Index Generation

The `StoryIndexGenerator` builds the sidebar index without executing stories:

```typescript
// core-server/utils/StoryIndexGenerator.ts
class StoryIndexGenerator {
  // For each story file matched by glob:
  // 1. Find matching indexer by test regex
  // 2. Call indexer.createIndex() to extract metadata via AST
  // 3. Combine into StoryIndex served at /index.json
}

// Default CSF indexer (from common-preset.ts)
const csfIndexer: Indexer = {
  test: /(stories|story)\.(m?js|ts)x?$/,
  createIndex: async (fileName, options) =>
    (await readCsf(fileName, options)).parse().indexInputs,
};
```

**What the indexer extracts:**
```typescript
interface IndexInput {
  type: 'story' | 'docs';
  exportName: string;        // "Primary"
  title?: string;            // "Components/Button"
  name?: string;             // Display name
  tags?: string[];           // Filtering tags
  rawComponentPath?: string; // "./Button.tsx"
  __stats?: {
    play?: boolean;          // Has play function
    loaders?: boolean;       // Has loaders
    render?: boolean;        // Custom render
    factory?: boolean;       // CSF4 factory pattern
  };
}
```

### Server Channel

Bidirectional communication between server and browser:

```typescript
// Server-side channel handlers (common-preset.ts)
export const experimental_serverChannel = async (channel, options) => {
  initFileSearchChannel(channel, options);       // File search for "+" button
  initCreateNewStoryChannel(channel, options);   // Story file generation
  initGhostStoriesChannel(channel, options);     // Ghost stories discovery
  initOpenInEditorChannel(channel, options);     // Open file in IDE
  initPreviewInitializedChannel(channel, options);
  return channel;
};
```

---

## Manager (`manager/`)

The React application that renders Storybook's UI (sidebar, toolbar, panels).

### Key Components

```
manager/
├── App.tsx              # Root component
├── container/           # Layout containers
├── components/          # UI components
│   ├── sidebar/         # Story tree, search
│   ├── panel/           # Addon panels
│   └── preview/         # Canvas wrapper
├── settings/            # About, shortcuts pages
├── hooks/               # Custom React hooks
└── globals.ts           # Global exports for addons
```

### Addon Registration

Addons register UI elements through the manager globals:

```typescript
// In an addon's manager.js
import { addons, types } from 'storybook/manager-api';

addons.register('my-addon', (api) => {
  addons.add('my-addon/panel', {
    type: types.PANEL,
    title: 'My Panel',
    render: ({ active }) => <MyPanel active={active} />,
  });
});
```

---

## Manager API (`manager-api/`)

State management for the manager, organized as 14 modules:

| Module | Purpose |
|--------|---------|
| `stories` | Story index, selection, navigation |
| `refs` | Composition (external Storybooks) |
| `globals` | Global args management |
| `layout` | Panel/sidebar visibility, sizes |
| `addons` | Addon panel registration |
| `shortcuts` | Keyboard shortcut handling |
| `notifications` | Toast notifications |
| `url` | URL ↔ state synchronization |
| `version` | Version info, update checks |
| `whatsnew` | What's new notifications |
| `settings` | User preferences |
| `channel` | Channel communication |
| `provider` | Provider pattern for DI |
| `openInEditor` | Open in IDE functionality |

### State & API Types

```typescript
// Combined from all modules
export type State = layout.SubState &
  stories.SubState &
  refs.SubState &
  notifications.SubState &
  // ... all module states

export type API = stories.SubAPI &
  layout.SubAPI &
  globals.SubAPI &
  // ... all module APIs
```

### React Hooks

```typescript
import {
  useStorybookApi,     // Access full API
  useStorybookState,   // Access full state
  useParameter,        // Get story parameter
  useArgs,             // Get/set story args
  useGlobals,          // Get/set globals
  useChannel,          // Subscribe to channel events
  useAddonState,       // Shared addon state
} from 'storybook/manager-api';
```

---

## Preview API (`preview-api/`)

Client-side story rendering in the preview iframe.

### Preview Class Hierarchy

```
Preview (base)
    └── PreviewWeb
         └── PreviewWithSelection
```

### Story Rendering Lifecycle

```typescript
// preview-api/modules/preview-web/render/StoryRender.ts
type RenderPhase =
  | 'preparing'    // Loading story module
  | 'loading'      // Running loaders
  | 'beforeEach'   // Running beforeEach hooks
  | 'rendering'    // Calling renderToCanvas
  | 'playing'      // Executing play function
  | 'played'       // Play completed
  | 'completing'   // Cleanup starting
  | 'completed'    // Render done
  | 'afterEach'    // Running afterEach hooks
  | 'finished'     // All done
  | 'aborted'      // Cancelled
  | 'errored';     // Error occurred
```

### Story Store

```typescript
// preview-api/modules/store/StoryStore.ts
class StoryStore<TRenderer> {
  storyIndex: StoryIndexStore;        // Story metadata
  projectAnnotations: {...};          // Global config
  userGlobals: GlobalsStore;          // User-set globals
  args: ArgsStore;                    // Per-story args
  hooks: Record<StoryId, HooksContext>;

  async loadStory({ storyId }): Promise<PreparedStory>;
  getStoryContext(story, options): StoryContext;
}
```

### Preview Hooks

```typescript
import {
  useArgs,           // [args, updateArgs, resetArgs]
  useGlobals,        // [globals, updateGlobals]
  useParameter,      // Get parameter value
  useStoryContext,   // Full story context
  useChannel,        // Channel communication
  // Note: these are Storybook-specific hooks for decorators, not React hooks
  useState,          // Persistent state across story re-renders
  useEffect,         // Side effects in decorators
} from 'storybook/preview-api';
```

---

## Channels (`channels/`)

Communication layer between manager, preview, and server.

### Channel Types

| Transport | Direction | Use Case |
|-----------|-----------|----------|
| PostMessage | Manager ↔ Preview | UI interactions |
| WebSocket | Browser ↔ Server | File watching, HMR |

### Creating a Channel

```typescript
// channels/index.ts
function createBrowserChannel({ page }): Channel {
  const transports = [new PostMessageTransport({ page })];

  if (CONFIG_TYPE === 'DEVELOPMENT') {
    transports.push(new WebsocketTransport({ url: channelUrl }));
  }

  return new Channel({ transports });
}
```

### Channel API

```typescript
class Channel {
  emit(eventName: string, ...args: any);
  on(eventName: string, listener: Listener);
  off(eventName: string, listener: Listener);
  once(eventName: string, listener: Listener);
  last(eventName: string);  // Get last event data
}
```

### Core Events

```typescript
// core-events/index.ts - Key events
enum events {
  // Story lifecycle
  STORY_SPECIFIED,          // Initial story selected
  STORY_PREPARED,           // Story loaded
  STORY_RENDERED,           // Render complete
  STORY_FINISHED,           // All hooks done
  STORY_RENDER_PHASE_CHANGED,

  // Args & globals
  UPDATE_STORY_ARGS,
  STORY_ARGS_UPDATED,
  UPDATE_GLOBALS,
  GLOBALS_UPDATED,

  // Index
  STORY_INDEX_INVALIDATED,  // Trigger re-index
  SET_INDEX,

  // Server communication
  FILE_COMPONENT_SEARCH_REQUEST,
  CREATE_NEW_STORYFILE_REQUEST,
  OPEN_IN_EDITOR_REQUEST,
}
```

---

## CSF Tools (`csf-tools/`)

AST-based parsing of Component Story Format files.

### CsfFile Class

```typescript
// csf-tools/CsfFile.ts
class CsfFile {
  // Parsed data
  _meta: { title, component, tags, ... };
  _stories: Map<exportName, { name, tags, parameters, ... }>;

  // Main entry point
  parse(): this;

  // Get index inputs for StoryIndexGenerator
  get indexInputs(): IndexInput[];
}
```

### Reading CSF Files

```typescript
import { readCsf, loadCsf } from 'storybook/internal/csf-tools';

// Parse without loading (for indexing)
const csf = await readCsf(filePath, options);
const parsed = csf.parse();
console.log(parsed.indexInputs);

// Load and execute (for runtime)
const csf = await loadCsf(filePath, options);
const stories = csf.parse().stories;
```

---

## Common (`common/`)

Shared Node.js utilities used across server-side code.

### Key Exports

```typescript
import {
  // Config loading
  loadMainConfig,
  loadPreviewOrConfigFile,
  getInterpretedFile,

  // Presets
  loadAllPresets,
  resolveAddonName,

  // Stories
  normalizeStories,

  // Package management
  JsPackageManagerFactory,

  // Paths
  resolvePathInStorybookCache,
  getProjectRoot,

  // Validation
  validateFrameworkName,
  validateConfigurationFiles,

  // Versions
  versions,  // All @storybook/* versions
} from 'storybook/internal/common';
```

### Preset System

Presets are loaded in order and merged:

```typescript
// common/presets.ts
async function loadAllPresets(options) {
  // Resolution order:
  // 1. Core presets (common-preset.js)
  // 2. Builder presets (builder-vite/preset, etc.)
  // 3. Framework presets (react-vite/preset, etc.)
  // 4. Addon presets (from main.js addons array)
  // 5. Override presets (common-override-preset.js)
}

// Preset hooks that can be defined:
type PresetHooks = {
  core: () => CoreConfig;
  stories: () => StoriesEntry[];
  staticDirs: () => StaticDir[];
  babel: () => BabelConfig;
  viteFinal: (config) => ViteConfig;      // Vite builder
  webpackFinal: (config) => WebpackConfig; // Webpack builder
  managerEntries: () => string[];
  previewAnnotations: () => string[];
  experimental_indexers: () => Indexer[];
};
```

---

## Telemetry (`telemetry/`)

Anonymous usage analytics (opt-out available).

```typescript
import { telemetry } from 'storybook/internal/telemetry';

// Send telemetry event
await telemetry('dev', {
  framework: '@storybook/react-vite',
  // ... metadata automatically included
});

// Event types
type EventType =
  | 'boot'        // CLI started
  | 'dev'         // Dev server started
  | 'build'       // Static build
  | 'init'        // Storybook initialized
  | 'upgrade'     // Version upgraded
  | 'error'       // Error occurred
  | 'remove'      // Addon removed
  | 'ghost-stories'; // Ghost stories flow
```

Debug telemetry with: `STORYBOOK_TELEMETRY_DEBUG=1`

---

## Theming (`theming/`)

Emotion-based theming system for Storybook UI.

```typescript
import {
  styled,           // Emotion styled
  css,              // Emotion css
  useTheme,         // Access theme
  ThemeProvider,    // Provide theme
  themes,           // Built-in themes
  create,           // Create custom theme
  convert,          // Convert theme vars
} from 'storybook/theming';

// Create custom theme
const myTheme = create({
  base: 'light',
  brandTitle: 'My Storybook',
  brandUrl: 'https://example.com',
  colorPrimary: '#FF4785',
  colorSecondary: '#1EA7FD',
});
```

---

## Test (`test/`)

Testing utilities for interaction testing.

```typescript
import {
  expect,      // Instrumented Chai expect
  fn,          // Create spy function
  userEvent,   // User interaction simulation
  within,      // Query within element
  waitFor,     // Wait for condition
} from 'storybook/test';

// In a play function
export const Clicked: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
    await expect(canvas.getByText('Clicked!')).toBeInTheDocument();
  },
};
```

### Instrumenter

The instrumenter wraps testing functions to enable step-through debugging:

```typescript
// instrumenter/index.ts
export const { expect } = instrument(
  { expect: rawExpect },
  {
    getKeys: (obj, depth) => { ... },
    mutate: true,
    intercept: (method) => method !== 'expect',
  }
);
```

---

## Universal Store (`shared/universal-store/`)

Cross-environment state synchronization using a leader-follower pattern.

```typescript
import { UniversalStore } from 'storybook/internal/core-server';

// Leader (server or first manager)
const leaderStore = UniversalStore.create({
  id: 'my-store',
  leader: true,
  initialState: { count: 0 },
});

// Follower (other environments)
const followerStore = UniversalStore.create({
  id: 'my-store',
  leader: false,
});

// Both will be synced automatically
leaderStore.setState({ count: 1 });
await followerStore.untilReady();
console.log(followerStore.getState()); // { count: 1 }
```

**Environments:**
- `SERVER` - Node.js dev server
- `MANAGER` - Manager UI in browser
- `PREVIEW` - Preview iframe in browser

---

## CLI Binaries (`bin/`)

Entry points for the CLI:

| File | Command |
|------|---------|
| `dispatcher.js` | Main entry, routes to subcommands |
| `loader.js` | ESM loader for TypeScript config |

---

## Key Configuration Files

### `main.ts`

```typescript
// .storybook/main.ts
export default {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-vitest',
  ],
  framework: '@storybook/react-vite',

  // Builder hooks
  viteFinal: async (config) => ({ ...config }),

  // Core config
  core: {
    disableTelemetry: false,
  },

  // Features
  features: {
    viewportStoryGlobals: true,
  },
};
```

### `preview.ts`

```typescript
// .storybook/preview.ts
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
  },
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: { icon: 'paintbrush', items: ['light', 'dark'] },
    },
  },
  decorators: [
    (Story, context) => <ThemeProvider theme={context.globals.theme}><Story /></ThemeProvider>,
  ],
  loaders: [
    async () => ({ user: await fetchUser() }),
  ],
  beforeEach: async () => {
    // Setup before each story
  },
};

export default preview;
```

### `manager.ts`

```typescript
// .storybook/manager.ts
import { addons } from 'storybook/manager-api';

addons.setConfig({
  sidebar: {
    showRoots: true,
    collapsedRoots: ['other'],
  },
  toolbar: {
    zoom: { hidden: true },
  },
});
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `STORYBOOK_TELEMETRY_DEBUG` | Log telemetry events |
| `STORYBOOK_DISABLE_TELEMETRY` | Opt out of telemetry |
| `DEBUG` | Enable debug logging |

---

## Related Documentation

- [CLAUDE.local.md](../../CLAUDE.local.md) - Monorepo architecture overview
- [scripts/README.md](../../scripts/README.md) - Task runner and sandbox system
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Contribution guidelines
