import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import type { InterPresetOptions } from '@storybook/core/internal/common';
import { resolvePackageDir, safeResolveModule } from '@storybook/core/internal/deep/utils/module';
import type {
  BuilderPlugin,
  LegacyAdapter,
  LegacyPreset,
  LegacyRegistrar,
  PluginMeta,
  Storybook,
  StorybookPlugin,
} from '@storybook/core/internal/instance';
import type { Builder, LoadedPreset, Options, PresetConfig } from '@storybook/core/internal/types';

import { dirname, isAbsolute, join } from 'pathe';

import { getPreviewBuilder } from './get-builders.ts';
import { loadAllPresets, resolveAddonName, type NativePresetResolver } from './presets.ts';

/** Plugin kinds a nested preset entry may load as; a framework only comes from `main.framework`. */
const NESTED_PLUGIN_KINDS: PluginMeta['kind'][] = ['addon', 'renderer', 'builder'];

/** Load `<pkg>/preset` packages in two passes: discover the builder and renderer, then load all. */
export const legacyAdapter: LegacyAdapter = {
  async load({ storybook, main, plugins: inputPlugins, baseOptions, registrar }) {
    const plugins = [...inputPlugins];
    const options = { ...baseOptions };
    const frameworkName =
      typeof main.framework === 'string' ? main.framework : main.framework?.name;
    const corePresets: PresetConfig[] = frameworkName ? [join(frameworkName, 'preset')] : [];
    const previewCorePresets: PresetConfig[] = [];
    const previewOverridePresets: string[] = [];
    const nativeFramework = plugins.some(
      (plugin) => plugin.meta.kind === 'framework' && 'builder' in plugin
    );
    const rendererPresets: PresetConfig[] = [];
    let builder: BuilderPlugin | undefined;
    let discovery: Awaited<ReturnType<typeof loadAllPresets>> | undefined;
    if (!nativeFramework || storybook.mode === 'build') {
      let presetsList: LoadedPreset[] = [];
      let presetOptions!: InterPresetOptions;
      discovery = await loadAllPresets(
        {
          ...options,
          corePresets: storybook.mode === 'build' && nativeFramework ? [] : corePresets,
          overridePresets: [],
          isCritical: true,
        },
        (loaded, context) => {
          presetsList = loaded;
          presetOptions = context;
        }
      );
      if (storybook.mode === 'build') {
        options.build = await registrar.resolveBuild(presetsList, presetOptions);
      }
    }
    if (nativeFramework) {
      corePresets.splice(0);
    } else {
      const discoveredPlugins: StorybookPlugin[] = [];
      const core = await discovery!.apply('core', {});
      const nativeRenderer =
        core.renderer &&
        (await registrar.resolveNativeFactory(core.renderer, 'renderer', options.configDir));
      if (nativeRenderer) {
        // Registers where the renderer preset would load, before the framework preset.
        rendererPresets.push(registrar.virtualPreset(nativeRenderer(undefined)));
      } else if (core.renderer) {
        const resolvedRenderer = resolveAddonName(options.configDir, core.renderer, options);
        if (resolvedRenderer) {
          rendererPresets.push(resolvedRenderer);
        }
        discoveredPlugins.push({
          meta: { name: core.renderer, kind: 'renderer' },
          setup(): void {},
        });
      }
      const builderName = typeof core.builder === 'string' ? core.builder : core.builder?.name;
      const nativeBuilder =
        builderName &&
        (await registrar.resolveNativeFactory(builderName, 'builder', options.configDir));
      if (nativeBuilder) {
        builder = nativeBuilder(
          typeof core.builder === 'object' ? core.builder.options : undefined
        );
        discoveredPlugins.unshift(builder);
      } else if (builderName) {
        const implementation = await getPreviewBuilder(builderName);
        builder = wrapLegacyBuilder(builderName, implementation);
        discoveredPlugins.unshift(builder);
        if (implementation.corePresets) {
          previewCorePresets.push(...implementation.corePresets);
        } else {
          const entry = builderName.startsWith('file:') ? fileURLToPath(builderName) : builderName;
          const directory = isAbsolute(entry) ? dirname(entry) : resolvePackageDir(entry);
          const preset = safeResolveModule({ specifier: join(directory, 'preset.js') });
          if (preset) previewCorePresets.push(preset);
        }
        previewOverridePresets.push(...(implementation.overridePresets ?? []));
      }
      plugins.splice(plugins[0]?.meta.kind === 'framework' ? 1 : 0, 0, ...discoveredPlugins);
    }
    for (const plugin of plugins) {
      corePresets.push(registrar.virtualPreset(plugin));
      if (!nativeFramework && plugin.meta.kind === 'framework') {
        continue;
      }
      if ('legacy' in plugin) {
        const { legacy } = plugin as LegacyPreset;
        const name = typeof legacy === 'string' ? legacy : legacy.name;
        const legacyOptions = typeof legacy === 'string' ? undefined : legacy.options;
        const resolved = resolveAddonName(storybook.configDir, name, legacyOptions);
        if (!resolved) {
          throw new Error(`Could not resolve legacy plugin "${name}".`);
        }
        corePresets.push({ ...resolved, options: legacyOptions } as PresetConfig);
      }
    }
    let presetsList: LoadedPreset[] = [];
    let presetOptions!: InterPresetOptions;
    await loadAllPresets(
      {
        ...options,
        main: { ...main, addons: [] },
        isCritical: true,
        corePresets: [...previewCorePresets, ...rendererPresets, ...corePresets],
        overridePresets: previewOverridePresets,
      },
      (loaded, context) => {
        presetsList = loaded;
        presetOptions = context;
      },
      createNativePresetResolver(registrar, options.configDir, plugins)
    );
    return { presets: presetsList, options: presetOptions, builder };
  },
};

/**
 * Load a preset or addon nested in `main.presets` or another preset through its native `<pkg>/node`
 * plugin when it has one, so official packages without a preset entry keep working there.
 */
function createNativePresetResolver(
  registrar: LegacyRegistrar,
  configDir: string,
  plugins: StorybookPlugin[]
): NativePresetResolver {
  const registered = new Set(plugins.map((plugin) => plugin.meta.name));
  return async (entry) => {
    // Entries the loader already resolved, such as `main`, plugins, or absolute preset files.
    if (typeof entry !== 'string' && 'type' in entry) {
      return undefined;
    }
    const { name, options } =
      typeof entry === 'string' ? { name: entry, options: undefined } : entry;
    for (const kind of NESTED_PLUGIN_KINDS) {
      const factory = await registrar.resolveNativeFactory(name, kind, configDir);
      if (factory) {
        const plugin = factory(options);
        if (registered.has(plugin.meta.name)) {
          return null;
        }
        registered.add(plugin.meta.name);
        return registrar.virtualPreset(plugin);
      }
    }
    return undefined;
  };
}

function wrapLegacyBuilder(name: string, builder: Builder<unknown>): BuilderPlugin {
  const getOptions = (storybook: Storybook): Options => {
    const { docs: _docs, ...options } = storybook.options;
    return { ...options, presets: storybook.presets, channel: storybook.channel };
  };
  return {
    meta: { name, kind: 'builder' },
    setup(): void {},
    async dev(storybook, { router, server, startTime }) {
      const result = await builder
        .start({
          router,
          // Legacy builders require a server; an unlistened one opens no port for in-process hosts.
          server: server ?? createServer(),
          startTime,
          options: getOptions(storybook),
          channel: storybook.channel,
        })
        .catch(async (error: unknown) => {
          await builder.bail().catch(() => undefined);
          throw error;
        });
      return { ...result, bail: () => (result ? result.bail() : builder.bail()) };
    },
    async build(storybook, { startTime }) {
      return builder.build({ startTime, options: getOptions(storybook) });
    },
    changeDetectionAdapter(storybook) {
      if (!builder.changeDetectionAdapter) {
        throw new Error(`Builder "${name}" does not support change detection.`);
      }
      return builder.changeDetectionAdapter(getOptions(storybook));
    },
  };
}
