import {
  getProjectRoot,
  loadAllPresets,
  loadMainConfig,
  resolveAddonName,
  validateFrameworkName,
} from 'storybook/internal/common';
import { oneWayHash } from 'storybook/internal/telemetry';
import type { BuilderOptions, CLIOptions, LoadOptions, Options } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { dirname, join, relative, resolve } from 'pathe';

import { resolvePackageDir } from '../shared/utils/module';

export async function loadStorybook(
  options: CLIOptions &
    LoadOptions &
    BuilderOptions & {
      storybookVersion?: string;
      previewConfigPath?: string;
    }
): Promise<Options> {
  const configDir = resolve(options.configDir);

  const cacheKey = oneWayHash(relative(getProjectRoot(), configDir));

  options.configType = 'DEVELOPMENT';
  options.configDir = configDir;
  options.cacheKey = cacheKey;

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
  });

  const { renderer, builder } = await presets.apply('core', {});
  const resolvedRenderer = renderer && resolveAddonName(options.configDir, renderer, options);

  const builderName = typeof builder === 'string' ? builder : builder?.name;

  if (builderName) {
    corePresets.push(join(dirname(builderName), 'preset.js'));
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
  });

  const features = await presets.apply('features');
  global.FEATURES = features;

  return {
    ...options,
    presets,
    features,
  } as Options;
}
