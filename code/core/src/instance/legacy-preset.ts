import { getProjectRoot, validateFrameworkName } from '@storybook/core/internal/common';
import { LegacyAdapterMissingError } from '@storybook/core/internal/server-errors';
import { oneWayHash } from '@storybook/core/internal/telemetry';
import type {
  Options,
  LoadedPreset,
  PresetConfig,
  StorybookConfig as LegacyConfig,
} from '@storybook/core/internal/types';

import { relative } from 'pathe';

import { getInstanceContext } from '../shared/instance-context.ts';
import type { InterPresetOptions } from '../common/presets.ts';
import { registerCommonOverrides } from './common-overrides.ts';
import { bridgeLegacyPresets } from './legacy-hooks.ts';
import { createHookRuntime } from './hooks.ts';
import { resolveNativeFactory } from './native-entry.ts';
import type { CreateStorybookInput, LegacyAdapter, LegacyRegistrar, Storybook } from './types.ts';
import type { BuilderPlugin, LegacyPreset, StorybookPlugin } from './plugins.ts';

/** Host inputs for applying `main.ts` and loading legacy presets. */
export type LegacyPresetInput = Pick<CreateStorybookInput, 'cliOptions'> & {
  /** Set up the host's defaults before any preset or plugin, so features resolve with them. */
  setupCommon?: () => Promise<void>;
  legacy?: LegacyAdapter;
};

const INSTANCE_PLUGIN = Symbol('instance-plugin');

export async function loadLegacyPresets(
  storybook: Storybook,
  inputMain: LegacyConfig,
  hooks: ReturnType<typeof createHookRuntime>,
  inputPlugins: StorybookPlugin[],
  input: LegacyPresetInput = {}
): Promise<{
  options: Options;
  builder?: BuilderPlugin;
  setup(
    setupPlugin: (plugin: StorybookPlugin, storybook: Storybook) => void | Promise<void>
  ): Promise<void>;
}> {
  const {
    addons: _addons,
    presets: _presets,
    ...mainFields
  } = inputMain as LegacyConfig & {
    presets?: unknown;
  };
  const mainPreset: LoadedPreset = {
    name: 'main',
    preset: mainFields,
    options: (inputMain as { options?: unknown }).options ?? {},
  };
  const registrar: LegacyRegistrar = {
    virtualPreset,
    async resolveBuild(presetsList, options) {
      const discovery = createHookRuntime();
      bridgeLegacyPresets({ presetsList, options }, discovery, discovery.callHook);
      registerCommonOverrides(discovery, options);
      return discovery.callHook('core:build:extend', {});
    },
    resolveNativeFactory,
  };
  const mainOptions = {
    ...input.cliOptions,
    configDir: storybook.configDir,
    configType: storybook.mode === 'build' ? ('PRODUCTION' as const) : ('DEVELOPMENT' as const),
    cacheKey:
      input.cliOptions?.cacheKey ?? oneWayHash(relative(getProjectRoot(), storybook.configDir)),
    channel: storybook.channel,
  };
  const mainBuild =
    storybook.mode === 'build'
      ? await registrar.resolveBuild([mainPreset], { ...mainOptions, isCritical: true })
      : undefined;
  // `build.test.disabledAddons` drops matching addons, native or legacy, before any of them loads.
  const disabledAddons = mainBuild?.test?.disabledAddons ?? [];
  const isDisabled = (name: string): boolean =>
    disabledAddons.some((entry) => name.includes(entry));
  const plugins = inputPlugins.filter(
    (plugin) => plugin.meta.kind !== 'addon' || !isDisabled(plugin.meta.name)
  );
  const main = disabledAddons.length
    ? {
        ...inputMain,
        addons: inputMain.addons?.filter(
          (addon) => !isDisabled(typeof addon === 'string' ? addon : addon.name)
        ),
      }
    : inputMain;
  const baseOptions = { ...mainOptions, main };
  const frameworkName = typeof main.framework === 'string' ? main.framework : main.framework?.name;
  if (typeof main.framework === 'string' || (main.framework && 'name' in main.framework)) {
    validateFrameworkName(frameworkName);
  }
  const legacyPlugin = plugins.find((plugin) => 'legacy' in plugin) as LegacyPreset | undefined;
  const nativeFramework = plugins.some(
    (plugin) => plugin.meta.kind === 'framework' && 'builder' in plugin
  );
  const mainPresets = (main as { presets?: unknown }).presets;
  const hasPresets =
    typeof mainPresets === 'function' || (Array.isArray(mainPresets) && mainPresets.length > 0);
  // Without a native framework, the preset loader discovers the renderer and builder from `core`.
  const core = main.core as unknown;
  const discovers =
    typeof core === 'function' ||
    (!!core && typeof core === 'object' && ('renderer' in core || 'builder' in core));
  const needsAdapter = !!legacyPlugin || hasPresets || (!nativeFramework && discovers);
  let loaded: { presets: LoadedPreset[]; options: InterPresetOptions; builder?: BuilderPlugin };
  if (needsAdapter) {
    if (!input.legacy) {
      const legacy = legacyPlugin?.legacy;
      throw new LegacyAdapterMissingError({
        name:
          (typeof legacy === 'string' ? legacy : legacy?.name) ??
          (hasPresets ? 'main.presets' : 'main.core'),
      });
    }
    loaded = await input.legacy.load({ storybook, main, plugins, baseOptions, registrar });
  } else {
    // Mirrors the preset loader for virtual entries: `main.ts` loads after every plugin.
    const options: InterPresetOptions = { ...mainOptions, isCritical: true };
    const presets: LoadedPreset[] = [
      ...plugins.map((plugin) => toLoadedPreset(virtualPreset(plugin))),
      mainPreset,
    ];
    if (storybook.mode === 'build') {
      options.build = mainBuild;
    }
    loaded = { presets, options };
  }
  const presetsList = loaded.presets;
  const orders = new Map(presetsList.map((preset, index) => [preset, index]));
  const presets = bridgeLegacyPresets(
    { presetsList, options: loaded.options },
    hooks,
    storybook.callHook,
    (preset) => orders.get(preset)!
  );
  registerCommonOverrides(hooks, loaded.options);
  if (input.setupCommon) {
    hooks.setRegistrationOrder(-1);
    await input.setupCommon();
  }
  const features = await storybook.callHook('core:features:extend', undefined);
  const context = getInstanceContext();
  if (context) {
    context.features = features;
  }
  hooks.setRegistrationOrder(presetsList.length);
  return {
    options: { ...loaded.options, presets, features } as Options,
    builder: loaded.builder,
    async setup(setupPlugin): Promise<void> {
      for (const loadedPreset of presetsList) {
        const plugin = (loadedPreset.preset as Record<symbol, StorybookPlugin>)[INSTANCE_PLUGIN];
        if (plugin) {
          hooks.setRegistrationOrder(orders.get(loadedPreset)!);
          await setupPlugin(plugin, storybook);
        }
      }
      hooks.setRegistrationOrder(presetsList.length);
    },
  };
}

function virtualPreset(plugin: StorybookPlugin): PresetConfig {
  return { type: 'virtual', name: plugin.meta.name, [INSTANCE_PLUGIN]: plugin } as PresetConfig;
}

function toLoadedPreset(config: PresetConfig): LoadedPreset {
  const { type: _type, name, ...preset } = config as { type: string; name: string };
  return { name, preset, options: {} };
}
