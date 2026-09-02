import { fileURLToPath } from 'node:url';

import { Channel, setChannel } from 'storybook/internal/channels';
import {
  getProjectRoot,
  loadAllPresets,
  loadMainConfig,
  resolveAddonName,
  validateFrameworkName,
} from 'storybook/internal/common';
import { oneWayHash } from 'storybook/internal/telemetry';
import type { BuilderOptions, CLIOptions, LoadOptions, Options } from 'storybook/internal/types';
import { applyServicesPresetOnce } from './utils/apply-services-preset-once.ts';

import { global } from '@storybook/global';

import { dirname, isAbsolute, join, relative, resolve } from 'pathe';

import { resolvePackageDir, safeResolveModule } from '../shared/utils/module.ts';

export async function loadStorybook(
  options: CLIOptions &
    LoadOptions &
    BuilderOptions & {
      storybookVersion?: string;
      previewConfigPath?: string;
      /**
       * The channel handed to every preset. Callers that prepared state on a channel of their own
       * (the `storybook tools` CLI prepares the UniversalStore singleton on one) must pass it here,
       * so addon hooks that answer requests over `options.channel` share the caller's bus.
       */
      channel?: Channel;
    }
): Promise<Options> {
  const configDir = resolve(options.configDir);

  const cacheKey = oneWayHash(relative(getProjectRoot(), configDir));

  options.configType = 'DEVELOPMENT';
  options.configDir = configDir;
  options.cacheKey = cacheKey;

  // Without a caller-supplied channel this is a transport-less local bus, as there is no dev
  // server to transport to.
  const channel = options.channel ?? new Channel({});
  setChannel(channel);

  const config = await loadMainConfig(options);
  const { framework } = config;
  const corePresets = [];

  let frameworkName = typeof framework === 'string' ? framework : framework?.name;
  if (!options.ignorePreview) {
    validateFrameworkName(frameworkName);
  }
  if (frameworkName) {
    corePresets.push(join(frameworkName, 'preset'));
  }

  frameworkName = frameworkName || 'custom';

  // Load first pass: We need to determine the builder
  // We need to do this because builders might introduce 'overridePresets' which we need to take into account
  // We hope to remove this in SB8
  let presets = await loadAllPresets({
    corePresets,
    overridePresets: [
      import.meta.resolve('storybook/internal/core-server/presets/common-override-preset'),
    ],
    ...options,
    isCritical: true,
    channel,
  });

  const { renderer, builder } = await presets.apply('core', {});
  const resolvedRenderer = renderer && resolveAddonName(options.configDir, renderer, options);

  const builderName = typeof builder === 'string' ? builder : builder?.name;

  if (builderName) {
    /* builderName can be a bare package name (e.g. '@storybook/builder-vite') or an already-resolved
       file URL / absolute path (e.g. 'file:///.../.../dist/index.js'). For bare package names, we
       need to resolve the package directory first; for already-resolved paths, dirname works directly.
    */
    const builderEntry = builderName.startsWith('file:') ? fileURLToPath(builderName) : builderName;
    const builderPresetDir = isAbsolute(builderEntry)
      ? dirname(builderEntry)
      : resolvePackageDir(builderEntry);
    // Not every builder ships this preset: builder-webpack5 declares its presets on its main module
    // instead, and only the dev server and static build load a builder module to reach them.
    const builderPreset = safeResolveModule({ specifier: join(builderPresetDir, 'preset.js') });

    if (builderPreset) {
      corePresets.push(builderPreset);
    }
  }

  // Load second pass: all presets are applied in order

  presets = await loadAllPresets({
    corePresets: [
      join(resolvePackageDir('storybook'), 'dist/core-server/presets/common-preset.js'),
      ...(resolvedRenderer ? [resolvedRenderer] : []),
      ...corePresets,
    ],
    overridePresets: [
      import.meta.resolve('storybook/internal/core-server/presets/common-override-preset'),
    ],
    ...options,
    channel,
  });

  const features = await presets.apply('features');
  global.FEATURES = features;

  await applyServicesPresetOnce(presets);

  return {
    ...options,
    // the resolved channel — the one the presets received — never the possibly-absent option
    channel,
    presets,
    features,
  } as Options;
}
