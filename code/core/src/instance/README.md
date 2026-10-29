# Storybook instance

An instance owns one Storybook project in a Node process.

- It owns one configuration, channel, story index, hook runtime, service registry, and toolset registry.
- Several instances can live in one Node process.
- The local tools CLI and the dev and build hosts create an instance.
- Attached tools create a headless instance connected to a running Storybook.

```ts
import { createStorybook, defineAddon } from 'storybook/internal/instance';
import { reactVite } from '@storybook/react-vite/node';

const storybook = await createStorybook({ configDir: '.storybook', mode: 'headless' });
const index = await storybook.getIndex();
const docs = storybook.toolsets.get('docs');
const service = storybook.services.get('core/module-graph', { internal: true });
await storybook.close();
```

- `@storybook/core` is the public instance API: `createStorybook`, the `define*` factories, `declareHooks`, the instance accessors, `getFeatures`, and their types.
- `@storybook/core/internal/instance` re-exports it plus the internals: `legacyPreset`, the `Legacy*` types, `getInstanceContext`, and `internal_*`.
- `storybook/internal/instance` re-exports `@storybook/core/internal/instance` and injects the built-in features into `createStorybook`.
- `storybook` re-exports `defineMain`, `defineAddon`, and their types for `main.ts`; its `defineMain` types the config from the framework's `StorybookFrameworks` entry and rejects other keys, unless the framework is not registered.

## Lifecycle

The lifecycle runs once:

- Load `main.ts` and validate plugin metadata.
- Set up the builder, renderer, framework defaults, framework, built-in addons, then user addons.
- Freeze options and notify `core:instance:ready`.
- Answer queries, or run the preview builder.
- Close, notifying `core:instance:close`.

Rules:

- Reading `storybook.options` during setup throws.
- Registration is limited to setup.
- The index generator initializes lazily on the first index request.
- Dev and headless modes use development configuration; build uses production configuration.
- Hosts pass CLI settings through `cliOptions`, attach the dev transport, and create a manager host with `createManagerHost(storybook)`.
- Each manager host owns its compiler state.
- The instance owns neither the server nor the manager.

## API

```ts
interface Storybook {
  readonly mode: CreateStorybookInput['mode'];
  readonly attached: boolean;
  readonly configDir: string;
  readonly workingDir: string;
  readonly options: ResolvedStorybookConfig;
  readonly builder: BuilderPlugin | undefined;
  readonly plugins: readonly PluginMeta[];
  hasPlugin(name: string): boolean;
  hook<K extends keyof StorybookHooks>(
    name: K,
    fn: HookHandler<K>,
    kind?: HookRegistrationKind<K>,
    stage?: 'override'
  ): void;
  registerService: typeof registerService;
  registerToolset(definition: AnyToolsetDefinition): void;
  callHook<K extends keyof StorybookHooks>(name: K, ...args: HookArgs<K>): Promise<HookResult<K>>;
  getIndex(): Promise<StoryIndex>;
  getStoryIndexGenerator(): Promise<StoryIndexGenerator>;
  readonly services: ServiceRegistry;
  readonly toolsets: ToolsetRegistry;
  readonly channel: Channel;
  readonly presets: Presets;
  close(): Promise<void>;
}
```

### Attached instances

- `CreateStorybookInput` accepts `attach?: { transport: ChannelTransport }` in `mode: 'headless'`.
- The transport joins the instance's own channel.
- `storybook.attached` is `true`, commands delegate to the running Storybook, and its stores are clients of the dev server's.
- Other instances have `attached: false`.
- Attachment with `mode: 'dev'` or `'build'` throws.

### Stores

- A store (`storybook/status`, `storybook/test-provider`, `storybook/test`, `storybook/checklist`) has one owner and any number of clients on one channel event, `UNIVERSAL_STORE:<id>`.
- The owner holds the state and answers state requests; clients route writes and events through it and apply what it broadcasts.
- The instance creates the status and test-provider stores on its channel when it is created, and disposes them on close (`services/stores/core-stores.ts`).
  - A dev, build, or headless instance owns them; an attached instance is a client of the dev server's.
  - `experimental_getStatusStore` and `experimental_getTestProviderStore` from `storybook/internal/services` read the current instance's stores and throw outside one.
- The `storybook/checklist` built-in owns its store on the instance channel and disposes it on close; an attached instance creates none.
- Addon-vitest's `storybook/test` store is owned by the instance's test runner runtime and disposed with it.
- The Vitest child creates clients of all three over its IPC channel; the runner bridges owner messages to it and its messages to the owner.
- In the browser, the manager's stores are clients on the page channel, or owners in a static build, which has no server.
- A store created without a channel uses the current instance's channel and is disposed on close; outside an instance in Node it stays unprepared.
- No realm, inventory, or election: who owns a store is decided where it is created.

## Plugins

```ts
import { fileURLToPath } from 'node:url';

const addon = defineAddon<{ verbose?: boolean }>((options) => ({
  meta: { name: 'my-addon' },
  setup(storybook) {
    storybook.hook('preview:annotations:collect', () => [
      fileURLToPath(import.meta.resolve('./preview.ts')),
    ]);
  },
}));

const storybook = await createStorybook({
  configDir: '.storybook',
  mode: 'headless',
  main: {
    framework: reactVite(),
    stories: ['./*.stories.ts'],
    addons: ['@storybook/addon-docs', addon({ verbose: true })],
  },
});
```

- `defineAddon`, `defineBuilder`, `defineRenderer`, and `defineFramework` set `meta.kind` on the factory result.
- They also brand the factory itself with `Symbol.for('storybook.plugin-factory')` set to that kind.
- A package becomes native by default-exporting a branded factory from `<pkg>/node`.
- A framework carries its `builder`, `renderer`, and optional default `addons`.
- Setup order keeps the legacy preset order:
  - builder, renderer, framework defaults, framework, built-in addons, then user addons;
  - renderer contributions precede framework contributions;
  - a framework's addons load before the framework, as a legacy framework preset's `addons` did.
- Each plugin sets up once per `meta.name` (`dedupe-plugins.ts`), across built-ins, framework addons, and `main.addons`:
  - the first occurrence keeps its position;
  - a later entry with options replaces an earlier one without, so `'pkg'` plus `pkg({ ... })` keeps the configured one;
  - entries with different options keep the first and log a warning.
  - Options come from branded factories, which record them on the plugin, or from a legacy `{ name, options }` entry.
- A framework string or `{ name, options }` entry loads natively when its package has a native factory, called with `options`.
  - `storybook.options.framework` keeps the user's value.
  - `resolveNativeFactory` resolves `<name>/node` from the config directory.
  - For a path or `file:` URL, it resolves the `./node` export of the nearest `package.json`.
  - Other entries go through the [legacy bridge](./HOOKS.md#legacy-bridge).

### Builders

- A builder owns `dev(storybook, { router, server, startTime, preview })`, `build(storybook, { startTime, outDir, preview })`, and `changeDetectionAdapter(storybook)`.
- `server` is optional on `dev()`.
  - It is absent when the host answers requests in-process, so no socket or HMR channel exists.
  - See the [server README](../../../lib/storybook/src/storybook/server/README.md) for the hosts.
- Hosts compute `preview` with `getPreviewSources` from `storybook/internal/preview-page`.
  - It holds the `iframe.html` page, the generated entry and project-annotations modules, their module ids, the externals map, and defines.
- The builder's optional `hmr` (`'vite'` or `'webpack'`) selects the HMR API of the generated modules.
- The builder supplies the story `importFn` module and the page's entry scripts.
- `storybook.builder` is readable from ready and always has the `BuilderPlugin` shape when configured.
- Each native builder factory owns its compiler state.

### Types

- `RendererPlugin<TTypes>` contributes optional `previewAnnotations` entries before its setup hooks.
- Its optional readonly `types` field carries story types for inference and is never assigned at runtime.
- Addon factories carry their preview-facing types on the same phantom field.
- Framework and main factories preserve these declarations for preview and story inference through `MainTypes`.

### Resources

- Long-lived resources a plugin starts (timers, pollers, watchers, child processes) must stop in `core:instance:close`, or be `unref()`ed.
- Otherwise they keep Node alive after the host closes.
- Legacy presets have no close hook; addons that own such resources move to `defineAddon`.
- See [`core:instance:close`](./HOOKS.md#coreinstanceclose) for an example.

## Hooks

- The runtime uses `hookable` with a typed `StorybookHooks` interface.
- Names follow `owner:subject:verb`; the caller's area owns the declaration in its `hooks.ts`.
- Verbs:
  - `extend` reduces a value;
  - `collect` concatenates list contributions;
  - `register` performs setup;
  - `before`, `after`, `ready`, and `close` notify handlers at a lifecycle boundary.
- Handlers may be async.
- Addon presence is read from `storybook.plugins`, not from hooks.

A third-party hook augments the public module and supplies its strategy on its first registration:

```ts
import type { Reduce } from '@storybook/core';

declare module '@storybook/core' {
  interface StorybookHooks {
    'my-addon:label:extend': Reduce<(label: string) => string>;
  }
}

const labels = defineAddon(() => ({
  meta: { name: 'my-addon' },
  setup(storybook) {
    storybook.hook('my-addon:label:extend', (label) => label.toUpperCase(), 'reduce');
  },
}));
// On an instance configured with labels(), after setup:
await storybook.callHook('my-addon:label:extend', 'button');
```

[HOOKS.md](./HOOKS.md) owns the rest:

- the full preset-to-hook mapping, owners, and declaration folders;
- strategies, Collect examples, and `'override'` ordering;
- the `declareHooks` and interface pattern;
- native-only hooks, including `core:instance:ready` and `core:instance:close`;
- the legacy bridge and private legacy keys.

## Reaching the instance

A plugin receives its instance as the `setup(storybook)` parameter; pass it on explicitly wherever you can.
For code that cannot receive it, such as a helper deep inside a hook handler, read the running instance:

```ts
import {
  bindToInstance,
  getStorybook,
  runWithStorybook,
  tryGetStorybook,
} from '@storybook/core';

const storybook = getStorybook(); // throws StorybookInstanceUnavailableError outside an instance
const maybe = tryGetStorybook(); // undefined outside an instance
```

- `getStorybook()` throws `StorybookInstanceUnavailableError` outside an instance, and while `main.ts` is evaluated, because the instance does not exist yet.
- `tryGetStorybook()` returns `undefined` instead.
- `runWithStorybook(storybook, fn)` runs `fn` in that instance's context, for tests and hosts that hold an instance.
- `bindToInstance(fn)` captures the current instance for a callback registered outside the async chain.
- The accessor is named `get*`, not `use*`, because `useStorybookApi` and `useStorybookState` are manager React hooks.

The accessor reads the async context each instance sets around setup, hook calls, and its methods.

- It follows `await`, timers, and promise callbacks started there.
- Two instances in one process each see their own.
- The carrier is one `AsyncLocalStorage` stored on `globalThis` under a symbol, so separately bundled Node entries share it.

The context is lost wherever work leaves the async chain:

- Worker threads and child processes start without it; pass the data they need.
- Callbacks a library registers outside the chain, such as an emitter or watcher created before the instance, run without it; wrap them with `bindToInstance(fn)` where they are registered, inside the instance.
- A replaced global `Promise` (zone.js) drops it in `.then` callbacks.

## No-preset packages

Official plugin packages ship a native `<pkg>/node` entry and no preset.

- Addons, builders, frameworks, and presets under `code/` export `./node` only.
- Renderers keep `./preset` as an exact alias of `./node`, because third-party framework presets still resolve `<renderer>/preset`.
- Old preset specifiers in `main.ts` still work:
  - `OFFICIAL_PRESET_SPECIFIERS` in [`native-entry.ts`](./native-entry.ts) matches `@storybook/<pkg>/preset*`, `@storybook/<pkg>/server/framework-preset-*`, and `storybook-addon-pseudo-states/preset`.
  - `toNativeEntryName` maps them to the package name, so `<pkg>/node` loads.
  - A deprecation warning names the replacement once per specifier; the old specifiers are removed in Storybook 12.
- [`check-no-preset.ts`](../../../../scripts/check/check-no-preset.ts) guards the rule for every package under `addons`, `builders`, `frameworks`, `presets`, and `renderers`.
  - It rejects a `./preset` or `./server/framework-preset*` export that is not an exact `./node` alias.
  - It rejects a root `preset.js`.
  - It rejects `presets.apply` in non-test source; use `storybook.callHook` instead.
- User-facing migration notes live in [MIGRATION.md](../../../../MIGRATION.md).

## Legacy entries

- When a framework or addon has no native `<pkg>/node` entry, or `main.ts` lists `presets`, core hands the plugins to the host's `legacy` adapter (`LegacyAdapter`).
- The adapter returns the loaded preset list for core to bridge; without an adapter, core throws `LegacyAdapterMissingError`.
- The product's adapter lives in `lib/storybook/src/storybook/compat/`, which only `storybook/instance.ts`, the shims, and tests may import.
- `storybook.presets.apply` invokes the mapped instance hook.
- Only the compat layer may call `presets.apply`: `legacy-hooks.ts`, `legacy-preset.ts`, and `lib/storybook/src/storybook/compat/`.
  - Other code reads through `storybook.callHook` or the instance API; outside an instance it throws instead of falling back to presets.
  - [`check-no-presets-apply.ts`](../../../../scripts/check/check-no-presets-apply.ts) enforces it for every package, run by `check-package.ts`.
  - `compat/options.ts` keeps `getBuilderOptions`, `getFrameworkName`, and `getRendererName`, which third-party frameworks and builders import from `storybook/internal/common`.
- See [Legacy bridge](./HOOKS.md#legacy-bridge) for loading passes and merge rules.

## Common plugin and features

- The product passes its common plugin into core, which sets it up before any preset or plugin and leaves it out of `storybook.plugins`.
- Without one, core sets up its own (`common-plugin.ts`: CSF indexer, `features`, services), which the product's common plugin extends.
- Core registers its own final adjustments to `features`, `framework`, `stories`, `typescript`, and `build` as `'override'` hooks (`common-overrides.ts`).
- Core applies `main.ts` itself and does not resolve product files by path.
- `features/index.ts` in `storybook` owns the ordered built-in addon list, the product flag defaults (`FEATURE_DEFAULTS`), and the flag of each switchable built-in.
  - The public instance entry injects the list into the core constructor.
  - A headless host without `storybook` passes no options: core uses only its own addons (docgen, story-docs, change detection) and its common plugin, which is enough for the index, the docs toolset, and change-detection statuses.
- Presence is the switch: a built-in left out of the list contributes nothing.
- Every listed built-in sets up; flags keep their pre-addon meaning and are read when a contribution is collected, so any flag source works.
  - A `false` UI flag drops only the built-in's manager entry; its preview annotations and server hooks stay.
  - Backgrounds, measure, outline, and highlight also skip their decorator or listener in the preview unless their flag is on, so portable stories (no `FEATURES`) run without them, as in base.
  - The components-manifest built-in serves `/manifests/*` and writes `manifests/` only while `componentsManifest` is on.
- Built-ins contribute like any addon: `manager` for the manager entry, `preview:annotations:collect` for preview annotations, `server:*` hooks for routes and static output.
  - Their hooks register before the framework, renderer, and `main.ts` addons, where core's presets used to run.
  - Core's built-ins (test, ghost stories, docgen, story-docs) take their entry paths as options, so core never resolves product files.
  - Review is a `storybook` built-in (`features/review/`); core keeps only the cross-realm contract the manager UI shares with it: the `core/review` service definition, its state transitions, events, and routes.
- `components-manifest` is a built-in: it serves `/manifests/*` through `server:app:extend` and writes `manifests/` through `server:static-output:collect`.
  - Renderers and `@storybook/addon-mcp` turn it on with a static `features: { componentsManifest: true }`.
  - `loadManifests` stays in core for the docs toolset.
- Preview annotations reach the page and addon-vitest only through `preview:annotations:collect`; core has no annotation registry.
- Core never imports the feature implementations.
- Node setup implementations use conditional package imports so browser annotation composition does not load server services.
- Resolved features:
  - The instance context owns them; `storybook.options.features` is the public source of truth.
  - Hosts inject them into browser pages as `FEATURES`; Node never sets that global.
  - Code reads them through `getFeatures()` (`core/src/shared/features.ts`), which returns the instance's features inside an instance and the page's `FEATURES` elsewhere.

## Shared state

Per-instance state is isolated; these remain shared:

- Core's own services are registered with ids under `core/` and require `internal: true`.
- Outside an instance, channel and registry globals keep their old role for preview, manager, and legacy consumers, as do the legacy services guards.
  - The service registry fallback is the browser realm registry; Node code registers on its instance.
  - No fallback for the toolset registry, the story index generator, readiness, dev-server subscriptions, the module graph, or the server's status and test-provider stores: they throw `StorybookInstanceUnavailableError` outside an instance.
  - The browser's stores wait for the page channel (`whenChannelInstalled`); there is no store realm on either side.
  - Toolset callers outside an instance go through one: `storybook.toolsets`, `runWithStorybook`, or the instance a `createTools` host owns. Tests use `useTestInstance()`.
- Node state lives on the instance: the project root, the MCP server, the status and test-provider stores, the Vitest child and its store, and the React component-meta manager.
  - `getProjectRoot()` caches per instance from its `workingDir`; outside an instance `findProjectRoot(cwd)` is uncached.
  - `scripts/check/check-no-node-globals.ts` rejects module-level `let`/`var` and `FALLBACK_*` in instance, services, toolset, store, open-service SDK, and addon Node code.
- Hook strategy declarations are process-wide static metadata; handlers stay on each instance.
- Open-service load bookkeeping and runtime IDs are module-wide.
  - Loads have distinct runtime keys; the synchronous dependency-discovery session is restored after each handler call.
- Module imports, the TypeScript loader, common config caches, and legacy plugin singletons are process-wide.
  - Node lets concurrent setups import the same preset or plugin entry safely.
  - Vitest's module runner can hand one instance the unfinished exports of a module another instance is still evaluating, so the shared Vitest config loads built presets and native plugin entries through Node.
- Legacy presets can own resources or globals with no teardown contract; the instance cannot dispose those safely.
  - React docgen parser and manifest caches are module-wide, reset per build and on close.
  - The bridge does not make arbitrary old addon implementations safe for concurrent projects.
  - Legacy presets that read `process.cwd()` see the host process's directory.
- Telemetry enablement, queued events, metadata, and error handlers are process-wide.
- Environment variables and dotenv discovery use the host process's environment and directory.
- Hosts using the same config or an explicitly shared output directory share manager cache files.

## Close

- Close first notifies `core:instance:close`.
- It then disconnects owned services and stores, clears toolsets, hooks, and channel listeners, stops owned graph subscriptions and docgen workers, and disposes a local change-detection host if one was started.
- Plugins close what they own: the MCP server state, the Vitest child process, and the React component-meta manager.
- Hosts dispose their preview compiler and transport.
- The Vitest plugin owns a headless instance and closes it in `closeBundle`.

## Source layout

The source is split across five packages:

```text
code/core/src/                  @storybook/core
  core/        instance, story-index, services, preview-page, common, channels, constants,
               core-events, csf, csf-tools, types, preview, preview-api, test (including
               instrumenter and mocking), component-meta, docs-tools, oxc-parser, telemetry,
               node-logger, client-logger, and core errors
    shared/    open-service, story-index, review, status-store, test-provider-store,
               universal-store, checklist-store, instance-context, features.ts, and router,
               toolbar, and viewport helpers
code/lib/ui/src/                @storybook/ui: components, theming, tour-guide
code/lib/manager/src/           @storybook/manager: ui, manager-api, router, builder-manager, shared
code/lib/open-service/src/      @storybook/open-service: the open-service client SDK
code/lib/storybook/src/         storybook
  storybook/   server, cli (including tools), bin, compat, and preview runtime
  features/    actions, backgrounds, controls, highlight, measure, outline, toolbar, viewport,
               component-testing, and components-manifest
  shims/       one file per public `storybook/*` entry
```

## Import direction

The layered packages have one direction, `core <- ui <- manager <- storybook`:

- `@storybook/core` imports only `@storybook/core/*`.
- `@storybook/ui` imports `@storybook/core/*` and `@storybook/ui/*`.
- `@storybook/manager` imports `@storybook/core/*`, `@storybook/ui/*`, and `@storybook/manager/*`.
- `storybook` may import all of them, and keeps every public `storybook/*` entry as a shim.
- `@storybook/open-service` imports only `@storybook/core/*`, so it installs and runs without `storybook`.
- Frameworks, renderers, builders, presets, and addons import their Node side from `@storybook/core/*` and their browser side from `storybook/*`.
- Every other workspace imports `storybook/*` only, never `@storybook/{core,ui,manager}`.

Each package README owns its own rules; see [core](../../README.md) and [open-service](../../../lib/open-service/README.md).

- Inside the lower packages, use the package's own specifier (for example `@storybook/core/test`), never `storybook/*`.
- `local-rules/storybook-monorepo-imports` in `scripts/eslint-plugin-local-rules` enforces the direction and the specifiers.
- `no-restricted-imports` overrides in `code/.oxlintrc.json` forbid relative paths that escape a package root, tests included.
- Tests in the upper packages reach core internals through deep entries (`@storybook/core/internal/deep/<path>`).
- Run `yarn lint:js:cmd core/src lib/ui/src lib/manager/src lib/storybook/src lib/open-service/src` from `code/` to check it.

Check forbidden source imports (no matches, exit status 1):

```sh
rg -n "(from |import\\()['\\\"](\\.\\./)+(manager|storybook|features)/" code/core/src
```
