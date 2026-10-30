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
import changeDetection from '../services/change-detection/node.ts';
import { StoryIndexGenerator } from '../story-index/StoryIndexGenerator.ts';
import type { InstanceContext } from '../shared/instance-context.ts';
import { clearRegistry } from '../shared/open-service/service-registry.ts';
import { getService, registerService } from '../shared/open-service/server.ts';
import {
  getRegisteredToolsets,
  getToolset,
  registerToolset,
} from '../shared/open-service/toolset-registry.ts';
import { setupCoreStores } from '../services/stores/core-stores.ts';
import { commonAddon } from './common-addon.ts';
import { dedupeAddons } from './dedupe-addons.ts';
import { createHookRuntime } from './hooks.ts';
import { instanceContext, registerInstanceContext } from './instance-context.ts';
import { loadLegacyPresets } from './legacy-preset.ts';
import { LEGACY_HOOKS } from './legacy-hooks.ts';
import { resolveNativeFactory } from './native-entry.ts';
import type { HookArgs, HookContext } from './hooks.ts';
import {
  legacyPreset,
  type BuilderAddon,
  type FrameworkAddon,
  type LegacyPreset,
  type AddonMeta,
  type RendererAddon,
  type StorybookConfig,
  type StorybookAddon,
} from './addons.ts';
import type {
  CreateStorybookInput,
  CreateStorybookOptions,
  ResolvedStorybookConfig,
  Storybook,
  StorybookBuildResult,
  StorybookDevServer,
} from './types.ts';

const ADDON_ORDER = ['builder', 'renderer', 'framework', 'addon'];
const CONFIGURATION_HOOKS = new Set<string>([...Object.values(LEGACY_HOOKS), 'legacy:core:extend']);

/** Create one isolated Storybook without loading it; `ready()` loads and configures it. */
export function createStorybook(
  input: CreateStorybookInput,
  {
    // Core-owned addons headless hosts need for the index and docs toolsets.
    builtInAddons = [docgen(), storyDocs(), changeDetection()],
    setupAddon = (addon, storybook) => addon.setup(storybook),
    common = commonAddon,
    legacy,
    dev: startDevServer,
    build: runBuild,
  }: CreateStorybookOptions = {}
): Storybook {
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
  let builder: BuilderAddon | undefined;
  let addonMetas: readonly AddonMeta[] | undefined;
  let generatorPromise: Promise<StoryIndexGenerator> | undefined;
  let readyPromise: Promise<void> | undefined;
  let closePromise: Promise<void> | undefined;
  let devPromise: Promise<StorybookDevServer> | undefined;
  let devServer: StorybookDevServer | undefined;
  let buildPromise: Promise<StorybookBuildResult> | undefined;
  // Added before addons are collected; joins the `main.ts` addons.
  const pendingAddons: StorybookAddon[] = [];
  // Added during setup; each sets up right after the addon that added it.
  const addedAddons: StorybookAddon[] = [];
  let plannedAddons: StorybookAddon[] | undefined;
  const metas: AddonMeta[] = [];

  const context: InstanceContext = {
    channel,
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
  // An attached host is a client of the dev server's stores.
  setupCoreStores(context, { owner: !input.attach });

  function requireOpen(): void {
    if (phase === 'close') {
      throw new Error('Storybook is closed.');
    }
  }

  async function setUp(addon: StorybookAddon): Promise<void> {
    await setupAddon(addon, storybook);
    metas.push(Object.freeze({ ...addon.meta }));
  }

  async function setUpAddedAddons(): Promise<void> {
    while (addedAddons.length) {
      const addon = addedAddons.shift()!;
      const planned = plannedAddons!;
      const existing = planned.find(
        (other) => other.meta.kind === addon.meta.kind && other.meta.name === addon.meta.name
      );
      if (existing) {
        if (dedupeAddons([existing, addon])[0] !== existing) {
          logger.warn(`"${addon.meta.name}" is already set up; ignoring the later options.`);
        }
        continue;
      }
      planned.push(addon);
      const { features } = addon;
      if (features) {
        storybook.hook('core:features:extend', (value) => ({ ...value, ...features }));
      }
      await setUp(addon);
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
    get addons() {
      if (!addonMetas) {
        throw new Error('Addon presence is unavailable until all addons have completed setup.');
      }
      return addonMetas;
    },
    hasAddon(name): boolean {
      // Legacy entries keep the path they were written with, such as a resolved preset file.
      return storybook.addons.some(
        (addon) => addon.name === name || normalizeAddonName(addon.name) === name
      );
    },
    get presets() {
      return presets;
    },
    addAddon(addon): void {
      requireOpen();
      if (addonMetas || (plannedAddons && phase !== 'setup')) {
        throw new Error(
          `Addons can only be added before ready() or during setup (current phase: ${phase}).`
        );
      }
      validateAddon(addon);
      if (addon.meta.kind !== 'addon') {
        throw new Error(
          `addAddon only accepts addons; "${addon.meta.name}" is a ${addon.meta.kind}.`
        );
      }
      (plannedAddons ? addedAddons : pendingAddons).push(addon);
    },
    ready(): Promise<void> {
      readyPromise ??= instanceContext.run(context, load);
      return readyPromise;
    },
    dev(): Promise<StorybookDevServer> {
      if (phase === 'close') {
        return Promise.reject(new Error('Storybook is closed.'));
      }
      devPromise ??= instanceContext.run(context, startDev);
      return devPromise;
    },
    build(): Promise<StorybookBuildResult> {
      if (phase === 'close') {
        return Promise.reject(new Error('Storybook is closed.'));
      }
      buildPromise ??= instanceContext.run(context, startBuild);
      return buildPromise;
    },
    hook(name, fn, kind, stage): void {
      instanceContext.run(context, () => {
        requireOpen();
        hooks.hook(name, fn, kind, stage);
      });
    },
    registerService: ((...args: Parameters<typeof registerService>) =>
      instanceContext.run(context, () => {
        requireOpen();
        return registerService(...args);
      })) as typeof registerService,
    registerToolset(definition): void {
      instanceContext.run(context, () => {
        requireOpen();
        registerToolset(definition);
      });
    },
    callHook(name, ...args) {
      return instanceContext.run(context, () => {
        requireOpen();
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
          // Started first but settled with the cleanups: the HTTP server waits on addon sockets.
          const devClosing = Promise.allSettled([(async () => devServer?.close())()]);
          try {
            const listenerErrors = await hooks.callHookSettled('core:instance:close', storybook);
            for (const error of listenerErrors) {
              logger.error('A core:instance:close listener failed:');
              logger.error(error);
            }
            const results = [
              ...(await devClosing),
              ...(await Promise.allSettled(
                [...context.cleanups].map((cleanup) => Promise.resolve().then(cleanup))
              )),
            ];
            const errors = results.filter((result) => result.status === 'rejected');
            if (errors.length) {
              throw new AggregateError(
                errors.map((result) => result.reason),
                'Storybook cleanup failed.'
              );
            }
          } finally {
            clearRegistry();
            hooks.removeAllHooks();
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
  return storybook;

  async function startDev(): Promise<StorybookDevServer> {
    if (input.mode !== 'dev') {
      throw new Error(`storybook.dev() requires mode: "dev" (current mode: ${input.mode}).`);
    }
    if (!startDevServer) {
      throw new Error(
        'This instance has no dev server; use createStorybook from "storybook" to start one.'
      );
    }
    await storybook.ready();
    const server = await startDevServer(storybook);
    if (phase === 'close') {
      await server.close();
      throw new Error('Storybook closed while its dev server was starting.');
    }
    devServer = server;
    return server;
  }

  async function startBuild(): Promise<StorybookBuildResult> {
    if (input.mode !== 'build') {
      throw new Error(`storybook.build() requires mode: "build" (current mode: ${input.mode}).`);
    }
    if (!runBuild) {
      throw new Error(
        'This instance has no static build; use createStorybook from "storybook" to build one.'
      );
    }
    await storybook.ready();
    return runBuild(storybook);
  }

  async function load(): Promise<void> {
    requireOpen();
    try {
      const main = applyOverrides(
        input.main ?? (await loadMainConfig({ configDir, cwd: workingDir })),
        input.overrides
      );
      // Set after main.ts evaluates, so getStorybook() there reports the load instead of a half-built instance.
      context.storybook = storybook;
      const addons: StorybookAddon[] = [];
      const framework =
        main.framework &&
        (typeof main.framework === 'object' && 'meta' in main.framework
          ? main.framework
          : await loadFramework(main.framework, configDir));
      if (framework) {
        addons.push(framework);
      }
      const nativeFramework =
        framework && 'builder' in framework ? (framework as FrameworkAddon) : undefined;
      if (nativeFramework) {
        addons.push(nativeFramework.builder, nativeFramework.renderer);
      }
      addons.push(...builtInAddons, ...(nativeFramework?.addons ?? []));
      for (const addon of main.addons ?? []) {
        addons.push(
          typeof addon === 'object' && 'meta' in addon ? addon : await loadAddon(addon, configDir)
        );
      }
      addons.push(...pendingAddons.splice(0));
      addons.forEach(validateAddon);
      addons.splice(0, addons.length, ...dedupeAddons(addons));
      plannedAddons = [...addons];
      // Matched by name, since deduplication may keep a user entry in place of a framework addon.
      const bundled = new Set(nativeFramework?.addons?.map((addon) => addon.meta.name));
      // A framework's addons set up right before it, where a legacy framework preset loads its addons.
      const rank = (addon: StorybookAddon): number =>
        bundled.has(addon.meta.name)
          ? ADDON_ORDER.indexOf('framework') - 0.5
          : ADDON_ORDER.indexOf(addon.meta.kind);
      addons.sort((a, b) => rank(a) - rank(b));
      const legacyMain = {
        ...main,
        framework:
          framework && 'legacy' in framework ? (framework as LegacyPreset).legacy : undefined,
        addons: nativeFramework
          ? []
          : addons
              .filter((addon) => addon.meta.kind !== 'framework' && 'legacy' in addon)
              .map((addon) => (addon as LegacyPreset).legacy),
      } as LegacyConfig;
      const loaded = await loadLegacyPresets(storybook, legacyMain, hooks, addons, {
        cliOptions: input.cliOptions,
        legacy,
        async setupCommon() {
          phase = 'setup';
          try {
            await common.setup(storybook);
            await setUpAddedAddons();
          } finally {
            phase = 'load';
          }
        },
      });
      legacyOptions = loaded.options;
      presets = legacyOptions.presets;
      builder = nativeFramework?.builder ?? loaded.builder;
      phase = 'setup';
      await loaded.setup(async (addon, storybook) => {
        const builtInIndex = builtInAddons.indexOf(addon);
        if (builtInIndex >= 0) {
          // Built-ins contribute first, right after the common addon, where core's presets ran.
          hooks.setRegistrationOrder(-1 + (builtInIndex + 1) / (builtInAddons.length + 1));
        }
        if (addon.meta.kind === 'renderer') {
          for (const entry of (addon as RendererAddon).previewAnnotations ?? []) {
            storybook.hook('preview:annotations:collect', () => [entry]);
          }
        }
        await setUp(addon);
        await setUpAddedAddons();
      });
      addonMetas = Object.freeze(metas);
      await applyServicesPresetOnce(storybook);
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
    } catch (error) {
      await storybook.close();
      throw error;
    }
  }
}

function applyOverrides(
  main: StorybookConfig,
  overrides: Partial<StorybookConfig> | undefined
): StorybookConfig {
  if (!overrides) {
    return main;
  }
  const merged: Record<string, unknown> = { ...main };
  for (const [key, value] of Object.entries(overrides)) {
    const current = merged[key];
    merged[key] =
      isConfigObject(current) && isConfigObject(value) ? { ...current, ...value } : value;
  }
  return merged as StorybookConfig;
}

// Addons are plain objects too, but an override replaces them whole.
function isConfigObject(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype &&
    !('meta' in value)
  );
}

function validateAddon(addon: StorybookAddon): void {
  if (
    typeof addon.meta?.name !== 'string' ||
    !addon.meta.name ||
    !ADDON_ORDER.includes(addon.meta.kind) ||
    typeof addon.setup !== 'function'
  ) {
    throw new Error('Every addon must declare meta.name, meta.kind, and setup(storybook).');
  }
}

async function loadFramework(
  framework: Preset,
  configDir: string
): Promise<FrameworkAddon | LegacyPreset> {
  const { name, options } =
    typeof framework === 'string' ? { name: framework, options: undefined } : framework;
  const factory = await resolveNativeFactory(name, 'framework', configDir);
  return factory ? factory(options) : legacyPreset(framework, 'framework');
}

/** Prefer an addon package's native `<pkg>/node` entry; packages without one stay on the preset loader. */
async function loadAddon(addon: Preset, configDir: string): Promise<StorybookAddon> {
  const { name, options } = typeof addon === 'string' ? { name: addon, options: undefined } : addon;
  const factory = await resolveNativeFactory(name, 'addon', configDir);
  return factory ? factory(options) : legacyPreset(addon);
}
