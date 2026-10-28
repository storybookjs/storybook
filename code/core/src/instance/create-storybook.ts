import '../preview/hooks.ts';
import '../story-index/hooks.ts';
import '../services/hooks.ts';

import { resolve } from 'pathe';

import { Channel } from '@storybook/core/internal/channels';
import {
  loadMainConfig,
  normalizeAddonName,
  normalizeStories,
} from '@storybook/core/internal/common';
import { logger } from '@storybook/core/internal/node-logger';
import type {
  Options,
  Preset,
  Presets,
  StorybookConfig as LegacyConfig,
} from '@storybook/core/internal/types';

import { applyServicesPresetOnce } from '../services/apply-services-preset-once.ts';
import docgen from '../shared/open-service/services/docgen/node.ts';
import storyDocs from '../shared/open-service/services/story-docs/node.ts';
import { StoryIndexGenerator } from '../story-index/StoryIndexGenerator.ts';
import type { InstanceContext } from '../shared/instance-context.ts';
import { clearRegistry } from '../shared/open-service/service-registry.ts';
import { getService, registerService } from '../shared/open-service/server.ts';
import {
  clearToolsetRegistry,
  getRegisteredToolsets,
  getToolset,
  registerToolset,
} from '../shared/open-service/toolset-registry.ts';
import { UniversalStore } from '../shared/universal-store/index.ts';
import { createUniversalStoreRealm } from '../shared/universal-store/realm.ts';
import { commonPlugin } from './common-plugin.ts';
import { createHookRuntime } from './hooks.ts';
import { instanceContext, registerInstanceContext } from './instance-context.ts';
import { loadLegacyPresets } from './legacy-preset.ts';
import { LEGACY_HOOKS } from './legacy-hooks.ts';
import { resolveNativeFactory } from './native-entry.ts';
import type { HookArgs, HookContext } from './hooks.ts';
import {
  legacyPreset,
  type BuilderPlugin,
  type FrameworkPlugin,
  type LegacyPreset,
  type PluginMeta,
  type RendererPlugin,
  type StorybookPlugin,
} from './plugins.ts';
import type {
  CreateStorybookInput,
  CreateStorybookOptions,
  ResolvedStorybookConfig,
  Storybook,
} from './types.ts';

const PLUGIN_ORDER = ['builder', 'renderer', 'framework', 'addon'];
const CONFIGURATION_HOOKS = new Set<string>([...Object.values(LEGACY_HOOKS), 'legacy:core:extend']);

/** Load and configure one isolated Storybook; omitted options fall back to core's own defaults. */
export async function createStorybook(
  input: CreateStorybookInput,
  {
    // Core-owned addons headless hosts need for the index and docs toolsets.
    builtInAddons = [docgen(), storyDocs()],
    setupPlugin = (plugin, storybook) => plugin.setup(storybook),
    common = commonPlugin,
    legacy,
  }: CreateStorybookOptions = {}
): Promise<Storybook> {
  if (input.attach && input.mode !== 'headless') {
    throw new Error('Attaching to Storybook requires mode: "headless".');
  }
  const workingDir = resolve(input.workingDir ?? process.cwd());
  const configDir = resolve(workingDir, input.configDir);
  const channel = new Channel({ async: input.mode === 'dev' });
  const hooks = createHookRuntime();
  let phase: 'load' | 'setup' | 'ready' | 'close' = 'load';
  let options: ResolvedStorybookConfig;
  let presets: Presets;
  let legacyOptions: Options | undefined;
  let builder: BuilderPlugin | undefined;
  let pluginMetas: readonly PluginMeta[] | undefined;
  let generatorPromise: Promise<StoryIndexGenerator> | undefined;
  let closePromise: Promise<void> | undefined;

  const context: InstanceContext = {
    channel,
    universalStoreRealm: createUniversalStoreRealm({
      channel,
      environment: input.attach
        ? UniversalStore.Environment.UNKNOWN
        : UniversalStore.Environment.SERVER,
    }),
    workingDir,
    state: new Map(),
    cleanups: new Set(),
    getStoryIndexGenerator: () => instanceContext.run(context, getStoryIndexGenerator),
  };
  const emit = channel.emit.bind(channel);
  const receive = channel.receive.bind(channel);
  channel.emit = (name, ...args): void => instanceContext.run(context, () => emit(name, ...args));
  channel.receive = (event): void => instanceContext.run(context, () => receive(event));
  if (input.attach) {
    channel.addTransport(input.attach.transport);
  }

  function requireSetup(): void {
    if (phase !== 'setup') {
      throw new Error(`Registration is only available during setup (current phase: ${phase}).`);
    }
  }

  function requireReady(): void {
    if (phase !== 'ready') {
      throw new Error(`Storybook is not ready (current phase: ${phase}).`);
    }
  }

  async function getStoryIndexGenerator(): Promise<StoryIndexGenerator> {
    requireReady();
    generatorPromise ??= (async () => {
      const directories = { workingDir, configDir };
      const generator = new StoryIndexGenerator(normalizeStories(options.stories, directories), {
        ...directories,
        indexers: options.indexers,
        docs: options.docs,
        features: options.features,
        storySorts: await storybook.callHook('index:story-sorts:collect', []),
      });
      await generator.initialize();
      return generator;
    })();
    return generatorPromise;
  }

  const storybook: Storybook = {
    mode: input.mode,
    attached: !!input.attach,
    configDir,
    workingDir,
    channel,
    get options() {
      return instanceContext.run(context, () => {
        requireReady();
        return options;
      });
    },
    get builder() {
      requireReady();
      return builder;
    },
    get plugins() {
      if (!pluginMetas) {
        throw new Error('Plugin presence is unavailable until all plugins have completed setup.');
      }
      return pluginMetas;
    },
    hasPlugin(name): boolean {
      // Legacy entries keep the path they were written with, such as a resolved preset file.
      return storybook.plugins.some(
        (plugin) => plugin.name === name || normalizeAddonName(plugin.name) === name
      );
    },
    get presets() {
      return presets;
    },
    hook(name, fn, kind, stage): void {
      instanceContext.run(context, () => {
        requireSetup();
        hooks.hook(name, fn, kind, stage);
      });
    },
    registerService: ((...args: Parameters<typeof registerService>) =>
      instanceContext.run(context, () => {
        requireSetup();
        return registerService(...args);
      })) as typeof registerService,
    registerToolset(definition): void {
      instanceContext.run(context, () => {
        requireSetup();
        registerToolset(definition);
      });
    },
    callHook(name, ...args) {
      return instanceContext.run(context, () => {
        if (phase === 'close') {
          throw new Error('Storybook is closed.');
        }
        const contextualArgs = CONFIGURATION_HOOKS.has(name)
          ? [args[0], { ...legacyOptions, ...(args[1] as HookContext | undefined) }]
          : args;
        return hooks.callHook(name, ...(contextualArgs as HookArgs<typeof name>));
      });
    },
    getStoryIndexGenerator() {
      return instanceContext.run(context, getStoryIndexGenerator);
    },
    getIndex() {
      return instanceContext.run(context, async () => {
        const generator = await getStoryIndexGenerator();
        return generator.getIndex();
      });
    },
    services: {
      get: ((...[serviceId, serviceOptions]: Parameters<typeof getService>) =>
        instanceContext.run(context, () => {
          requireReady();
          return getService(serviceId, serviceOptions);
        })) as typeof getService,
    },
    toolsets: {
      get: ((id: string) =>
        instanceContext.run(context, () => {
          requireReady();
          return getToolset(id);
        })) as typeof getToolset,
      values: () =>
        instanceContext.run(context, () => {
          requireReady();
          return getRegisteredToolsets();
        }),
    },
    close() {
      return instanceContext.run(context, () => {
        closePromise ??= (async () => {
          phase = 'close';
          try {
            const listenerErrors = await hooks.callHookSettled('core:instance:close', storybook);
            for (const error of listenerErrors) {
              logger.error('A core:instance:close listener failed:');
              logger.error(error);
            }
            const results = await Promise.allSettled(
              [...context.cleanups].map((cleanup) => Promise.resolve().then(cleanup))
            );
            const errors = results.filter((result) => result.status === 'rejected');
            if (errors.length) {
              throw new AggregateError(
                errors.map((result) => result.reason),
                'Storybook cleanup failed.'
              );
            }
          } finally {
            clearRegistry();
            clearToolsetRegistry();
            hooks.removeAllHooks();
            for (const store of context.universalStoreRealm.instances.values()) {
              store.__dispose();
            }
            context.universalStoreRealm.instances.clear();
            channel.removeAllListeners();
            context.cleanups.clear();
            context.state.clear();
            generatorPromise = undefined;
          }
        })();
        return closePromise;
      });
    },
  };

  registerInstanceContext(storybook, context);
  return instanceContext.run(context, async () => {
    try {
      const main = input.main ?? (await loadMainConfig({ configDir, cwd: workingDir }));
      // Set after main.ts evaluates, so getStorybook() there reports the load instead of a half-built instance.
      context.storybook = storybook;
      const plugins: StorybookPlugin[] = [];
      const framework =
        main.framework &&
        (typeof main.framework === 'object' && 'meta' in main.framework
          ? main.framework
          : await loadFramework(main.framework, configDir));
      if (framework) {
        plugins.push(framework);
      }
      const nativeFramework =
        framework && 'builder' in framework ? (framework as FrameworkPlugin) : undefined;
      if (nativeFramework) {
        plugins.push(nativeFramework.builder, nativeFramework.renderer);
      }
      plugins.push(...builtInAddons, ...(nativeFramework?.addons ?? []));
      for (const addon of main.addons ?? []) {
        plugins.push(
          typeof addon === 'object' && 'meta' in addon ? addon : await loadAddon(addon, configDir)
        );
      }
      for (const plugin of plugins) {
        if (
          typeof plugin.meta?.name !== 'string' ||
          !plugin.meta.name ||
          !PLUGIN_ORDER.includes(plugin.meta.kind) ||
          typeof plugin.setup !== 'function'
        ) {
          throw new Error('Every plugin must declare meta.name, meta.kind, and setup(storybook).');
        }
      }
      const bundled = new Set<StorybookPlugin>(nativeFramework?.addons);
      // A framework's addons set up right before it, where a legacy framework preset loads its addons.
      const rank = (plugin: StorybookPlugin): number =>
        bundled.has(plugin)
          ? PLUGIN_ORDER.indexOf('framework') - 0.5
          : PLUGIN_ORDER.indexOf(plugin.meta.kind);
      plugins.sort((a, b) => rank(a) - rank(b));
      const legacyMain = {
        ...main,
        framework:
          framework && 'legacy' in framework ? (framework as LegacyPreset).legacy : undefined,
        addons: nativeFramework
          ? []
          : plugins
              .filter((plugin) => plugin.meta.kind !== 'framework' && 'legacy' in plugin)
              .map((plugin) => (plugin as LegacyPreset).legacy),
      } as LegacyConfig;
      const loaded = await loadLegacyPresets(storybook, legacyMain, hooks, plugins, {
        cliOptions: input.cliOptions,
        legacy,
        async setupCommon() {
          phase = 'setup';
          try {
            await common.setup(storybook);
          } finally {
            phase = 'load';
          }
        },
      });
      legacyOptions = loaded.options;
      presets = legacyOptions.presets;
      builder = nativeFramework?.builder ?? loaded.builder;
      phase = 'setup';
      const metas: PluginMeta[] = [];
      await loaded.setup(async (plugin, storybook) => {
        if (plugin.meta.kind === 'renderer') {
          for (const entry of (plugin as RendererPlugin).previewAnnotations ?? []) {
            storybook.hook('preview:annotations:collect', () => [entry]);
          }
        }
        await setupPlugin(plugin, storybook);
        metas.push(Object.freeze({ ...plugin.meta }));
      });
      pluginMetas = Object.freeze(metas);
      await applyServicesPresetOnce(presets);
      const [stories, indexers, docs, staticDirs, previewAnnotations, features] = await Promise.all(
        [
          storybook.callHook('core:stories:collect', []),
          storybook.callHook('index:indexers:collect', []),
          storybook.callHook('core:docs:extend', undefined),
          storybook.callHook('core:static-dirs:collect', []),
          storybook.callHook('preview:annotations:collect', []),
          storybook.callHook('core:features:extend', undefined),
        ]
      );
      context.features = features;
      options = Object.freeze({
        ...legacyOptions,
        framework: main.framework,
        main,
        presets,
        stories,
        indexers,
        docs,
        staticDirs,
        previewAnnotations,
        features,
      });
      phase = 'ready';
      await storybook.callHook('core:instance:ready', storybook);
      return storybook;
    } catch (error) {
      await storybook.close();
      throw error;
    }
  });
}

async function loadFramework(
  framework: Preset,
  configDir: string
): Promise<FrameworkPlugin | LegacyPreset> {
  const { name, options } =
    typeof framework === 'string' ? { name: framework, options: undefined } : framework;
  const factory = await resolveNativeFactory(name, 'framework', configDir);
  return factory ? factory(options) : legacyPreset(framework, 'framework');
}

/** Prefer an addon's native `<pkg>/node` plugin; packages without one stay on the preset loader. */
async function loadAddon(addon: Preset, configDir: string): Promise<StorybookPlugin> {
  const { name, options } = typeof addon === 'string' ? { name: addon, options: undefined } : addon;
  const factory = await resolveNativeFactory(name, 'addon', configDir);
  return factory ? factory(options) : legacyPreset(addon);
}
