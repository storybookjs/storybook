# Hooks replace presets

Every preset key maps to a named hook on the Storybook instance.
Plugins register handlers with `storybook.hook(name, handler)`; callers read values with `storybook.callHook(name, seed, ctx)`.
Paths below are relative to `code/`.
Each declaration folder owns a `hooks.ts`.

## Preset keys

| Old preset | New hook | Strategy | Owner | Declaration folder |
| --- | --- | --- | --- | --- |
| `babel` | `builder:babel:extend` | Reduce | builder | `builders/builder-webpack5/src` |
| `babelDefault` | `builder:babel-default:extend` | Reduce | builder | `builders/builder-webpack5/src` |
| `build` | `core:build:extend` | Reduce | core | `core/src/instance` |
| `core` | `core:config:extend` | Reduce | core | `core/src/instance` |
| `csfIndexer` | `index:csf:extend` | Reduce | index | `core/src/story-index` |
| `docs` | `core:docs:extend` | Reduce | core | `core/src/instance` |
| `entries` | `preview:entries:collect` | Collect | preview | `core/src/preview` |
| `env` | `core:env:extend` | Reduce | core | `core/src/instance` |
| `experimental_componentManifestGenerator` | `index:component-manifest-generator:extend` | Reduce | index | `core/src/story-index` |
| `experimental_devServer` | `server:app:extend` | Reduce | server | `lib/storybook/src/storybook/server` |
| `experimental_docgenProvider` | `core:docgen-providers:collect` | Collect | core | `core/src/services` |
| `experimental_enrichCsf` | `legacy:experimental_enrichCsf:extend` | Reduce | legacy | `core/src/instance` (`legacy-hooks.ts`) |
| `experimental_importParsers` | `core:import-parsers:collect` | Collect | core | `core/src/services` |
| `experimental_indexers` | `index:indexers:collect` | Collect | index | `core/src/story-index` |
| `experimental_manifests` | `index:manifests:extend` | Reduce | index | `core/src/story-index` |
| `experimental_serverAPI` | `server:api:extend` | Reduce | server | `lib/storybook/src/storybook/server` |
| `experimental_serverChannel` | `server:channel:ready` | Notify | server | `lib/storybook/src/storybook/server` |
| `experimental_storyDocsProvider` | `core:story-docs-provider:extend` | Reduce | core | `core/src/services` |
| `experimental_vueDocgenEngine` | `legacy:experimental_vueDocgenEngine:extend` | Reduce | legacy | `renderers/vue3/src` (`node.ts`) |
| `favicon` | `manager:favicon:extend` | Reduce | manager | `lib/manager/src/builder-manager` |
| `features` | `core:features:extend` | Reduce | core | `core/src/instance` |
| `framework` | `core:framework:extend` | Reduce | core | `core/src/instance` |
| `frameworkOptions` | `core:framework-options:extend` | Reduce | core | `core/src/instance` |
| `internal_getArgTypesData` | `legacy:internal_getArgTypesData:extend` | Reduce | legacy | `core/src/instance` (`legacy-hooks.ts`) |
| `isDocgenProviderEnabled` | `core:docgen-enabled:extend` | Reduce | core | `core/src/services` |
| `logLevel` | `preview:log-level:extend` | Reduce | preview | `core/src/preview` |
| `managerEntries` | `manager:entries:collect` | Collect | manager | `lib/manager/src/builder-manager` |
| `managerHead` | `manager:head:extend` | Reduce | manager | `lib/manager/src/builder-manager` |
| `mdxLoaderOptions` | `legacy:mdxLoaderOptions:extend` | Reduce | legacy | `addons/docs/src/node` (`hooks.ts`) |
| `optimizeViteDeps` | `builder:vite-deps:collect` | Collect | builder | `builders/builder-vite/src` |
| `options` | `legacy:options:extend` | Reduce | legacy | `addons/docs/src/node` (`hooks.ts`) |
| `previewAnnotations` | `preview:annotations:collect` | Collect | preview | `core/src/preview` |
| `previewBody` | `preview:body:extend` | Reduce | preview | `core/src/preview` |
| `previewHead` | `preview:head:extend` | Reduce | preview | `core/src/preview` |
| `previewHmr` | `preview:hmr:extend` | Reduce | preview | `core/src/preview` |
| `refs` | `manager:refs:extend` | Reduce | manager | `lib/manager/src/builder-manager` |
| `resolvedReact` | `legacy:resolvedReact:extend` | Reduce | legacy | `core/src/instance` (`legacy-hooks.ts`) |
| `security` | `server:security:extend` | Reduce | server | `lib/storybook/src/storybook/server` |
| `services` | `core:services:register` | Notify | core | `core/src/services` |
| `staticDirs` | `core:static-dirs:collect` | Collect | core | `core/src/instance` |
| `stories` | `core:stories:collect` | Collect | core | `core/src/instance` |
| `storyIndexGenerator` | `index:generator:extend` | Reduce | index | `core/src/story-index` |
| `storySorts` | `index:story-sorts:collect` | Collect | index | `core/src/story-index` |
| `swc` | `builder:swc:extend` | Reduce | builder | `builders/builder-webpack5/src` |
| `tags` | `core:tags:extend` | Reduce | core | `core/src/instance` |
| `title` | `manager:title:extend` | Reduce | manager | `lib/manager/src/builder-manager` |
| `typescript` | `core:typescript:extend` | Reduce | core | `core/src/instance` |
| `viteFinal` | `builder:vite:extend` | Reduce | builder | `builders/builder-vite/src` |
| `webpack` | `builder:webpack-config:extend` | Reduce | builder | `builders/builder-webpack5/src` |
| `webpackFinal` | `builder:webpack:extend` | Reduce | builder | `builders/builder-webpack5/src` |
| `webpackInstance` | `builder:webpack-instance:extend` | Reduce | builder | `builders/builder-webpack5/src` |

Keys missing from the table use the fallback described in [Legacy bridge](#legacy-bridge).

## Strategies

- Reduce: each handler receives the previous value and returns the next one.
- Collect: native handlers return only their contributions, which concatenate with the seed list.
  - Pass a seed list when calling a Collect hook; the seed is included once.
  - Register a list-seeded Collect handler with `'reduce'` to transform the accumulated list instead.
- Notify: handlers run for their side effects; native return values are discarded.
- `experimental_devServer` returns the application, so `server:app:extend` is Reduce.

Register preview annotations, indexers, and static directories directly through Collect hooks:

```ts
storybook.hook('preview:annotations:collect', () => [
  fileURLToPath(import.meta.resolve('./preview.ts')),
]);
storybook.hook('index:indexers:collect', () => [myIndexer]);
storybook.hook('core:static-dirs:collect', () => [{ from: './public', to: '/' }]);
```

- The instance collects these into `options.previewAnnotations`, `options.indexers`, and `options.staticDirs`.
- Legacy `staticDirs` presets contribute through the bridge in preset order, alongside native handlers and main configuration.
- Services and toolsets do not use Collect hooks; a `core:services:register` handler calls `registerService` and `registerToolset`.

Values and context are typed by the owning area:

```ts
storybook.hook('builder:vite:extend', (config, ctx) => ({ ...config, clearScreen: false }));
await storybook.callHook('preview:annotations:collect', []);
```

## Ordering and overrides

- Native hooks run at their plugin's setup position.
- `storybook.hook(name, handler, kind, 'override')` runs a handler after main configuration handlers.
  - Use it for legacy override contributions.
  - The Webpack builder registers its `builder:swc:extend` defaults this way (`builders/builder-webpack5/src/node/index.ts`).

## Declaring hooks

Hook names and types live on the `StorybookHooks` interface in `core/src/instance/hooks.ts`.
Runtime strategies are registered next to the types with `declareHooks({ [name]: 'reduce' | 'collect' | 'notify' })`.

- Core areas export their own interface, and `StorybookHooks` extends all of them:
  - `PreviewHooks` in `core/src/preview/hooks.ts`.
  - `IndexHooks` in `core/src/story-index/hooks.ts`.
  - `ServiceHooks` in `core/src/services/hooks.ts`.
  - `LegacyHooks` in `core/src/instance/legacy-hooks.ts`.
- Core never augments `StorybookHooks` from its own source, because bundled declarations drop relative augmentations.
- Other packages augment the public module:

```ts
declare module '@storybook/core' {
  interface StorybookHooks {
    'server:app:extend': Reduce<(app: ServerApp, ctx?: HookContext) => ServerApp>;
  }
}

declareHooks({ 'server:app:extend': 'reduce' });
```

- The type build fails when a bundled declaration still contains a relative `declare module` ([`generate-types-rolldown.ts`](../../../../scripts/build/utils/generate-types-rolldown.ts)).
- Product and manager hook declarations load with their own entry points; core imports only core source.

## Native-only hooks

These hooks have no preset equivalent.

### `core:instance:ready`

- Notify, declared in `core/src/instance`.
- Runs once, after setup, and receives the storybook.
- `storybook.options` and `getStoryIndexGenerator()` are available.
- Registration is closed, so register services during setup and hand them work from this hook.

### `core:instance:close`

- Notify, declared in `core/src/instance`.
- Runs once per instance on the first `close()`, in every mode, and also when startup fails after setup began.
- Receives the storybook.
- Handlers run in reverse registration order, so dependants close before what they depend on, and before core's internal cleanups.
- A failing handler is logged; it does not stop the others or reject `close()`.
- Registration and `callHook` are closed.

Long-lived resources start in `core:instance:ready` and stop in `core:instance:close`:

```ts
const poller = defineAddon(() => ({
  meta: { name: 'my-poller' },
  setup(storybook) {
    let timer: ReturnType<typeof setInterval> | undefined;
    storybook.hook('core:instance:ready', () => {
      timer = setInterval(poll, 5000);
    });
    storybook.hook('core:instance:close', () => clearInterval(timer));
  },
}));
```

### `core:story-render:extend`

- Reduce, declared in `core/src/services`.
- Supplies the `StoryRenderAccess` (`screenshot(request)`) that the `stories` toolset's `screenshot` method renders through.
- The seed is `undefined`; without a handler the method throws `StoryRenderUnavailableError`.
- The product's common plugin provides it from `lib/storybook/src/storybook/server/story-screenshot.ts` and closes it in `core:instance:close`.

### `index:invalidated:after`

- Notify, declared in `core/src/story-index/hooks.ts`.
- Receives the new story index once per regeneration after a watched file change.
- Only the dev server fires it, from the `index.json` route's watcher; the preview host and headless instances don't.
- It never blocks `/index.json`, and a throwing listener is logged, not rethrown.

### `server:mcp:extend`

- Reduce, declared in `lib/storybook/src/storybook/server`.
- Supplies the MCP status and endpoint written to the hosted instance registry.
- The dev server seeds it from `main.ts`.

### `server:app:extend` and the preview host

- The dev server calls `server:app:extend` to mount its endpoints and start dev-only service subscriptions.
- The preview host deliberately skips it; see the [server README](../../../lib/storybook/src/storybook/server/README.md).

## Legacy bridge

The instance bridges legacy presets to hooks.
Product hosts under `storybook/server` create an instance, call its hooks, attach the dev transport, and add the manager builder.
The host's `LegacyAdapter` loads the presets; see [Legacy entries](./README.md#legacy-entries).

Loading:

- `legacyPreset` adapts package-name entries.
- Legacy frameworks keep two preset passes: discover the builder, then load renderer, framework or builder, and main.
- When the framework's `core.builder` or `core.renderer` names a package with a native factory, the bridge instantiates it.
  - A native builder receives the builder options.
  - A native renderer registers where the renderer preset would have loaded.
- Any other builder module's `corePresets` and `overridePresets` join the second pass, and its legacy `Builder` is wrapped as `storybook.builder`.
- Build mode resolves the legacy `build` flags before loading the final preset list; other modes load that list in one pass.
- Native setups register hooks at their positions among those presets, preserving main and override precedence.
- After loading, the bridge walks the flattened preset exports and registers them in that order.

Calls:

- `storybook.presets.apply` invokes the mapped instance hook.
- Mapped keys call the hook in the table.
- Any other key uses `legacy:<escaped-name>:extend`, always Reduce.
  - Static arrays, objects, and functions keep the existing preset merge behavior.
  - Percent signs and colons are escaped without collisions; the empty name has a distinct nonempty encoding.
- Legacy Collect handlers keep their accumulator signature and can replace, filter, prepend, or reorder the list.
- Legacy values merge as presets did:
  - falsy exports are skipped;
  - static arrays concatenate;
  - static objects merge shallowly;
  - other values replace.
- Legacy functions keep `this`, args and preset-options precedence, recursive `presets.apply`, and the flattened `presetsList`.
- Compatibility calls to Notify hooks keep the old notification return chain.

### `core`

- The `core` preset key maps to `core:config:extend`, the live `core` config read by builders, the server, the manager, and the preview page.
- `legacy:core:extend` is only an alias of `core:config:extend`, deprecated until Storybook 12.
- Native builders name themselves in `core.builder`; builders read `framework.options.builder` and their factory options first.

### Private keys

These keys exist for one consumer and the plugins that feed it.

- `legacy:experimental_enrichCsf:extend`, `legacy:internal_getArgTypesData:extend`, and `legacy:resolvedReact:extend` are declared in `legacy-hooks.ts`.
- `legacy:mdxLoaderOptions:extend` and `legacy:options:extend` are declared by addon-docs in `addons/docs/src/node/hooks.ts`.
- `legacy:experimental_vueDocgenEngine:extend` is declared and registered as `'reduce'` by the `@storybook/vue3` renderer in `renderers/vue3/src/node.ts`.
- Callers:
  - addon-docs: `addons/docs/src/mdx-plugin.ts`, `addons/docs/src/node/resolved-react.ts`, `addons/docs/src/node/vite-final.ts`, `addons/docs/src/node/webpack.ts`.
  - addon-vitest: `addons/vitest/src/vitest-plugin/index.ts` calls `legacy:internal_getArgTypesData:extend`.
- The Vitest addon imports `viteCorePlugins` from `@storybook/builder-vite/node` instead of applying a preset.

### Removed and alias keys

- `previewMainTemplate` and `webpackVersion` are no longer supported.
  - Core owns the preview page, and the Webpack builder reads the version of its own `webpack`.
- `isAddonA11yEnabled` and `isAddonVitestEnabled` are no longer declared hooks.
  - Read addon presence from `storybook.plugins` or `storybook.hasPlugin(name)` after plugin setup.
  - `hasPlugin` also matches a legacy entry written as a path inside the package by its package name.
  - The list covers built-ins, framework, builder, renderer, and configured addons, including legacy package-name entries.
  - Legacy-only consumers can still apply those keys through the `legacy:<name>:extend` fallback.
- `storyIndexGenerator` is a compatibility alias.
  - Instance consumers call `storybook.getStoryIndexGenerator()` directly.
  - Its Reduce hook keeps overrides made by legacy presets for legacy callers.
- `csfIndexer`, `swc`, and `experimental_serverAPI` keep their hooks as extension points.

### Ownership

- Title and favicon belong to the manager builder, browser log level to preview, and security to the server.
- Shared configuration stays in core: stories, features, docs, tags, TypeScript, env, build flags, framework selection and options, and static directories.

## Bridge tests

- `lib/storybook/src/storybook/compat/legacy-hooks.test.ts` compares mapped keys against the preset apply implementation.
  - It covers replacement, defaults, recursion, `this` and options, private names, and concurrent calls.
- [`legacy-hooks.integration.test.ts`](../../../lib/storybook/src/storybook/compat/legacy-hooks.integration.test.ts) loads the internal `code/.storybook` through both paths and compares every mapped key with `toEqual`.
  - Functions, cycles, and class instances are normalized to their shapes; returned provider or plugin functions are not executed.
  - Fetch is disabled.
  - The duplicate `storybook/test-provider` warning from separately bundled consumers is filtered; other warnings fail the test.
- Official packages have no preset to compare against.
  - [`check-no-preset.ts`](../../../../scripts/check/check-no-preset.ts) fails a plugin package that exports `./preset`, ships a root `preset.js`, or calls `presets.apply`.
  - See [No-preset packages](./README.md#no-preset-packages) for the `<pkg>/node` rule.
