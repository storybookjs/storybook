import { join, relative, resolve } from 'node:path';

import {
  getProjectRoot,
  loadAllPresets,
  loadMainConfig,
  resolveAddonName,
  validateFrameworkName,
} from '@storybook/core/common';
import { oneWayHash } from '@storybook/core/telemetry';
import type { BuilderOptions, CLIOptions, LoadOptions, Options } from '@storybook/core/types';
import { global } from '@storybook/global';

export async function loadStorybook(
  options: CLIOptions &
    LoadOptions &
    BuilderOptions & {
      storybookVersion?: string;
      previewConfigPath?: string;
    }
): Promise<Options> {
  const configDir = resolve(options.configDir);

  const rootDir = getProjectRoot();
  const cacheKey = oneWayHash(relative(rootDir, configDir));

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
      require.resolve('@storybook/core/core-server/presets/common-override-preset'),
    ],
    ...options,
    isCritical: true,
  });

  const { renderer } = await presets.apply('core', {});
  const resolvedRenderer = renderer && resolveAddonName(options.configDir, renderer, options);

  // Load second pass: all presets are applied in order

  presets = await loadAllPresets({
    corePresets: [
      require.resolve('@storybook/core/core-server/presets/common-preset'),
      ...(resolvedRenderer ? [resolvedRenderer] : []),
      ...corePresets,
    ],
    overridePresets: [
      require.resolve('@storybook/core/core-server/presets/common-override-preset'),
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
