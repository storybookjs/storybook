import type { PresetProperty } from 'storybook/internal/types';

export const addons: PresetProperty<'addons'> = [
  import.meta.resolve('@storybook/preset-server-webpack'),
];

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-webpack5'),
  renderer: import.meta.resolve('@storybook/server/preset'),
};
