import type { PresetProperty } from 'storybook/internal/types';

export const addons: PresetProperty<'addons'> = [
  import.meta.resolve('@storybook/preset-server-webpack'),
];

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: import.meta.resolve('@storybook/builder-webpack5'),
      options: typeof framework === 'string' ? {} : framework.options.builder || {},
    },
    renderer: import.meta.resolve('@storybook/server/preset'),
  };
};
