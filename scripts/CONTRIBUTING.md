# Scripts Directory

This directory contains the build tooling, task orchestration, and sandbox generation systems for the Storybook monorepo.

## Directory Structure

```
scripts/
├── task.ts                 # Main task runner entry point
├── tasks/                  # Individual task definitions
│   ├── compile.ts          # Compile monorepo packages
│   ├── sandbox.ts          # Create sandbox from template
│   ├── sandbox-parts.ts    # Sandbox creation steps (900+ lines)
│   ├── dev.ts              # Run sandbox dev server
│   ├── build.ts            # Build static sandbox
│   └── ...                 # Other tasks
├── sandbox/                # Sandbox generation utilities
│   ├── generate.ts         # Generate repros from templates
│   └── utils/              # Yarn setup, templates
├── utils/                  # Shared utilities
│   ├── constants.ts        # Directory paths, ports
│   ├── exec.ts             # Command execution wrapper
│   ├── cli-step.ts         # Storybook CLI step executor
│   ├── yarn.ts             # Yarn 2 configuration
│   └── options.ts          # CLI option parsing
├── build/                  # ESBuild package bundling
├── release/                # Release automation
├── run-registry.ts         # Verdaccio local npm registry
└── verdaccio.yaml          # Verdaccio configuration
```

## Task Runner System

The task runner (`task.ts`) is a custom orchestration system that manages task dependencies using topological sorting.

### Running Tasks

```bash
yarn task <task-name> [options]
```

### Task Interface

Every task in `scripts/tasks/*.ts` implements this interface:

```typescript
type Task = {
  description: string;              // UI label for prompts
  service?: boolean;                // Stays running (dev server, registry)
  dependsOn?: TaskKey[] | ((details, options) => TaskKey[]);
  ready: (details, options?) => Promise<boolean>;  // Is task already done?
  run: (details, options) => Promise<void | AbortController>;
  junit?: boolean;                  // Handles own test reporting
};
```

### Task Categories

**Monorepo tasks** (no `--template` required):

| Task | Description | Dependencies |
|------|-------------|--------------|
| `install` | Install monorepo dependencies | - |
| `compile` | Compile all packages | `install` |
| `check` | TypeScript type checking | `compile` |
| `publish` | Publish to local verdaccio | `compile` |
| `run-registry` | Start verdaccio (ports 6001/6002) | `publish` |

**Sandbox tasks** (require `--template`):

| Task | Description | Dependencies |
|------|-------------|--------------|
| `generate` | Generate repro from template script | `run-registry` |
| `sandbox` | Create full sandbox with stories | `compile` or `run-registry` |
| `dev` | Start dev server (port 6006) | `sandbox` |
| `build` | Build static Storybook | `sandbox` |
| `serve` | Serve built Storybook (port 8001) | `build` |
| `smoke-test` | Basic functionality tests | `sandbox` |
| `e2e-tests-dev` | Playwright E2E tests | `sandbox` |
| `test-runner-dev` | Storybook test runner | `sandbox` |
| `vitest-integration` | Vitest portable stories | `sandbox` |
| `bench` | Performance benchmarks | `sandbox` |
| `chromatic` | Visual regression tests | `build` |

### CLI Options

| Flag | Type | Description |
|------|------|-------------|
| `--template <key>` | string | Template key (e.g., `react-vite/default-ts`) |
| `--link` / `--no-link` | boolean | Link packages vs publish to registry |
| `--start-from <value>` | string | Where to start execution |
| `--prod` | boolean | Build for production |
| `--dry-run` | boolean | List commands without executing |
| `--skip-cache` | boolean | Skip NX remote cache |
| `--debug` | boolean | Print all logs |
| `--junit` | boolean | Store test results as XML |
| `--addon <name>` | string[] | Extra addons to install |
| `--dir <name>` | string | Custom sandbox directory name |

### The `--start-from` Flag

Controls where in the dependency chain execution begins:

| Value | Behavior | Use case |
|-------|----------|----------|
| `auto` | Skip ready tasks, run unready ones | CI default, fastest |
| `never` | Error if any task is already ready | Strict validation |
| `task` | Run only the final task | Quick re-run |
| `<task-name>` | Reset from that task, rebuild dependents | Rebuild specific step |
| _(not set)_ | Interactive prompt | Local development |

**Examples:**

```bash
# Fast: reuse everything that's ready
yarn task e2e-tests-dev --template react-vite/default-ts --start-from auto

# Rebuild from sandbox step (keeps compile)
yarn task e2e-tests-dev --template react-vite/default-ts --start-from sandbox

# Only run final task (assumes deps ready)
yarn task e2e-tests-dev --template react-vite/default-ts --start-from task
```

### Task Dependencies Graph

```
install
   ↓
compile ──────────────────────────────────┐
   ↓                                      │
   ├── check                              │
   │                                      │
   └── publish                            │
          ↓                               │
       run-registry                       │
          ↓                               │
       generate ──────────────────────────┤
                                          │
                                          ↓
                                     sandbox (--link uses compile, --no-link uses run-registry)
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ↓                     ↓                     ↓
                   dev              smoke-test               build
                    │               e2e-tests-dev               │
                    │               test-runner-dev             │
                    │               vitest-integration          ↓
                    │                                        serve
                    │                                       chromatic
                    ↓
              (stays running)
```

## Link vs No-Link Mode

This is the most important concept to understand for local development vs CI.

### Link Mode (`--link`, default for local dev)

```
install → compile → sandbox
```

**How it works:**
1. `compile` runs `yarn nx run-many -t compile` (without `-c production`)
2. Generates re-exports pointing to source: `export * from '../../src/...'`
3. `sandbox` runs `yarn link --all --relative` to symlink packages
4. Source changes reflect immediately (no recompile needed for TS)

**Detection:** Check `code/core/dist/manager-api/index.d.ts`:
```typescript
// Link mode content:
export * from '../../src/manager-api/index.ts';
```

### No-Link Mode (`--no-link`, used by CI)

```
install → compile → publish → run-registry → sandbox
```

**How it works:**
1. `compile` runs `yarn nx run-many -t compile -c production`
2. Generates actual `.d.ts` type definition files
3. `publish` packs and publishes all packages to local verdaccio
4. `sandbox` installs packages from `http://localhost:6001/`

**Detection:** Check `code/core/dist/manager-api/index.d.ts`:
```typescript
// No-link mode content:
export type { ... }  // Actual type definitions
```

### When to Use Which

| Scenario | Mode | Command |
|----------|------|---------|
| Fast local development | `--link` | `yarn task dev --template react-vite/default-ts` |
| Reproducing CI failures | `--no-link` | `yarn task dev --template react-vite/default-ts --no-link` |
| Testing package distribution | `--no-link` | As above |
| Performance benchmarking | `--no-link` | `yarn task bench --template ...` |

**Important:** Link mode can hide issues that only appear when packages are installed from a registry. If CI fails but local works, try `--no-link`.

## Sandbox Creation Pipeline

The `sandbox` task (`tasks/sandbox.ts`) orchestrates a complex multi-step process defined in `tasks/sandbox-parts.ts`.

### Step-by-Step Breakdown

```
1. create()        → Copy repro or generate via CLI
2. install()       → Install deps (yarn link or verdaccio)
3. init()          → Run `storybook init`
4. addStories()    → Link template stories from code/
5. addGlobalMocks() → Copy __mocks__ directory
6. setupVitest()   → Configure vitest.config.ts
7. addExtraDependencies() → Install extra packages
8. extendMain()    → Modify .storybook/main.ts
9. setImportMap()  → Configure package.json imports
10. runMigrations() → Run codemods (e.g., CSF Factories)
11. extendPreview() → Modify .storybook/preview.ts
12. NX caching     → Copy to ROOT/sandbox/ (without node_modules)
```

### Key Functions in sandbox-parts.ts

**`create(details, options)`**
- For `inDevelopment` templates: copies from `repros/{key}/after-storybook`
- For normal templates: runs `storybook repro {key}` CLI command

**`install(details, options)`**
- Link mode: runs `storybook link "{sandboxDir}"` from code/
- No-link mode: configures yarn for verdaccio, runs `yarn install`

**`init(details, options)`**
- Runs `storybook init --yes`
- Handles framework-specific setup (Angular, Svelte, React Native)
- Adds package scripts with `NODE_OPTIONS='--preserve-symlinks'`

**`addStories(details, options)`**
- Symlinks `code/{renderer}/template/stories` → `sandbox/template-stories/`
- Symlinks `code/{framework}/template/stories` → `sandbox/src/stories/`
- Symlinks addon stories from `code/addons/{addon}/template/stories`
- Updates `main.ts` stories field and preview annotations

**`extendMain(details, options)`**
- Merges `template.modifications.mainConfig` into main.ts
- Adds `viteFinal` or `webpackFinal` for sandbox-specific config
- Sets `disableWhatsNewNotifications: true`
- Adds esbuild-loader for webpack builds (to handle template-stories)

### Directory Locations

```typescript
// From scripts/utils/constants.ts
ROOT_DIRECTORY = '/path/to/storybook'
CODE_DIRECTORY = '/path/to/storybook/code'
REPROS_DIRECTORY = '/path/to/storybook/repros'
SANDBOX_DIRECTORY = '../storybook-sandboxes'  // Outside repo!
JUNIT_DIRECTORY = '/path/to/storybook/test-results'
```

**Sandbox structure:**
```
../storybook-sandboxes/react-vite-default-ts/
├── .storybook/
│   ├── main.ts
│   └── preview.ts
├── src/
│   └── stories/           # Framework stories (processed by build system)
│       └── components/    # Symlinked from renderer
├── template-stories/      # Addon/core stories (processed by esbuild-loader)
│   ├── core/
│   ├── addons/
│   └── renderers/
├── __mocks__/             # Global mocks for testing
├── storybook-static/      # Build output
└── .bench/                # Benchmark results
```

## Verdaccio Local Registry

The `run-registry` task starts a local npm registry using Verdaccio.

### Architecture

```
Port 6001 (Proxy)                Port 6002 (Verdaccio)
       │                                │
       │  URL contains "storybook"      │
       │  or "sb" or PUT request?       │
       │         │                      │
       │    YES ─┼──────────────────────→ Verdaccio
       │         │                      │
       │    NO ──┼──────────────────────→ https://registry.npmjs.org
       │
```

This setup gives:
- Fast installs for non-Storybook packages (direct to npm)
- Local versions for Storybook packages (via verdaccio)
- Ability to test unreleased changes

### Publishing to Verdaccio

The `publish` task:
1. Runs `yarn nx run-many -t pack -c production` to create tarballs
2. Publishes each tarball to verdaccio via `npm publish`
3. Stores tarballs in `ROOT/packs/`

### Accessing Verdaccio UI

Visit `http://localhost:6002` to browse published packages.

## NX Integration

The task runner integrates with NX for caching and parallel execution.

### NX Project Names

NX project names strip the `@storybook/` prefix:
- `@storybook/react` → `react`
- `@storybook/builder-vite` → `builder-vite`
- `storybook` (core) → `storybook`

### Common NX Commands

```bash
# Compile all packages
yarn nx run-many -t compile -c production

# Compile specific package
yarn nx compile react -c production

# Skip cache
yarn nx run-many -t compile -c production --skip-nx-cache
```

### NX Caching in Sandbox Task

When `NX_CLI_SET=true` (set by NX):
1. After sandbox creation, copies to `ROOT/sandbox/{template-key}/`
2. Excludes `node_modules` and `.yarn/cache` to keep cache small
3. On cache hit, restores from `ROOT/sandbox/` and reinstalls deps

## CLI Step Executor

The `executeCLIStep()` function (`utils/cli-step.ts`) runs Storybook CLI commands:

```typescript
// Available steps
steps.repro     // storybook repro
steps.init      // create-storybook (init)
steps.add       // storybook add
steps.link      // storybook link
steps.build     // storybook build
steps.dev       // storybook dev
steps.migrate   // storybook migrate
steps.automigrate // storybook automigrate
```

Each step uses the correct executable:
- `dev`, `build` → `code/core/dist/bin/dispatcher.js`
- `init` → `code/lib/create-storybook/dist/bin/index.js`
- Others → `code/lib/cli-storybook/dist/bin/index.js`

## Debugging

### Debug Flags

```bash
# Print all command output
yarn task sandbox --template react-vite/default-ts --debug

# Dry run (show commands without executing)
yarn task sandbox --template react-vite/default-ts --dry-run
```

### Common Issues

**"Task X is ready" error with `--start-from never`**
- The task was already completed. Use `--start-from auto` or `--start-from <task>`.

**Sandbox fails but CI passes (or vice versa)**
- Try `--no-link` to match CI behavior exactly.
- Link mode can hide issues with package exports/types.

**Port already in use**
- Dev server uses port 6006 (`STORYBOOK_SERVE_PORT`)
- Verdaccio uses ports 6001 (proxy) and 6002 (server)
- Run `lsof -i :6006` to find the process

**"Cannot find module" errors in sandbox**
- Ensure `compile` task completed successfully
- For link mode: check symlinks with `ls -la node_modules/@storybook/`
- For no-link mode: check verdaccio is running, packages are published

**NX cache issues**
- Add `--skip-cache` to bypass remote cache
- Delete `ROOT/sandbox/{template}/` to clear local cache

### Inspecting Sandbox

```bash
# Go to sandbox directory
cd ../storybook-sandboxes/react-vite-default-ts

# Check main.ts configuration
cat .storybook/main.ts

# Check linked packages (link mode)
ls -la node_modules/@storybook/

# Check installed versions (no-link mode)
yarn why @storybook/react
```

## JUnit Test Reporting

When `--junit` is set:
- Results written to `test-results/{task}.xml`
- Template key prefixed to classname for CI grouping
- Metadata (framework version, template details) stored in system-err

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STORYBOOK_SANDBOX_ROOT` | Override sandbox directory location |
| `STORYBOOK_SERVE_PORT` | Override dev/serve port (default: 6006/8001) |
| `NX_CLI_SET` | Set by NX when running via `yarn nx` |
| `IN_STORYBOOK_SANDBOX` | Set to `true` during sandbox creation |
| `STORYBOOK_DISABLE_TELEMETRY` | Disable telemetry in CLI commands |
| `CLEANUP_SANDBOX_NODE_MODULES` | Remove node_modules after generation |

## Writing a New Task

1. Create `scripts/tasks/my-task.ts`:

```typescript
import type { Task } from '../task';

export const myTask: Task = {
  description: 'Description for prompts',

  // Optional: is this a long-running service?
  service: false,

  // What must run before this task?
  dependsOn: ['sandbox'],
  // Or dynamic:
  // dependsOn: (details, options) => options.link ? ['compile'] : ['run-registry'],

  // Is the task already done?
  async ready({ sandboxDir }, options) {
    return pathExists(join(sandboxDir, 'my-output'));
  },

  // Run the task
  async run({ sandboxDir, template, key }, { dryRun, debug }) {
    await exec(
      'my-command',
      { cwd: sandboxDir },
      { dryRun, debug, startMessage: '🚀 Running my task' }
    );

    // For services, return an AbortController
    // return controller;
  },

  // Optional: does this task write its own junit results?
  junit: false,
};
```

2. Register in `scripts/task.ts`:

```typescript
import { myTask } from './tasks/my-task';

export const tasks = {
  // ... existing tasks
  'my-task': myTask,
};
```

3. Run it:

```bash
yarn task my-task --template react-vite/default-ts
```
