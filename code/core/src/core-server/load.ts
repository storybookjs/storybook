import { join, relative, resolve } from 'node:path';

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

import { resolveModule } from '../shared/utils/module';

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
      resolveModule({
        pkg: 'storybook',
        exportPath: 'internal/core-server/presets/common-override-preset',
      }),
    ],
    ...options,
    isCritical: true,
  });

  const { renderer } = await presets.apply('core', {});
  const resolvedRenderer = renderer && resolveAddonName(options.configDir, renderer, options);

  // Load second pass: all presets are applied in order

  presets = await loadAllPresets({
    corePresets: [
      resolveModule({
        pkg: 'storybook',
        customSuffix: 'dist/core-server/presets/common-preset.js',
      }),
      ...(resolvedRenderer ? [resolvedRenderer] : []),
      ...corePresets,
    ],
    overridePresets: [
      resolveModule({
        pkg: 'storybook',
        exportPath: 'internal/core-server/presets/common-override-preset',
      }),
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
