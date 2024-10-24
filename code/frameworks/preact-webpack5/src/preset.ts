import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

export const addons: PresetProperty<'addons'> = [
  dirname(fileURLToPath(import.meta.resolve('@storybook/preset-preact-webpack/package.json'))),
];

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: fileURLToPath(import.meta.resolve('@storybook/builder-webpack5')),
      options: typeof framework === 'string' ? {} : framework.options.builder || {},
    },
    renderer: fileURLToPath(import.meta.resolve('@storybook/preact/preset')),
  };
};
