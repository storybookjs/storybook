import type { PresetProperty } from 'storybook/internal/types';
import { getBuilderOptions } from 'storybook/internal/common';

export const addons: PresetProperty<'addons'> = [
  import.meta.resolve('@storybook/preset-server-webpack'),
];

export const core: PresetProperty<'core'> = async (config, options) => {

  return {
    ...config,
    builder: {
      name: import.meta.resolve('@storybook/builder-webpack5'),
      options: await getBuilderOptions(options),
    },
    renderer: import.meta.resolve('@storybook/server/preset'),
  };
};
