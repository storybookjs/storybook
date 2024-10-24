import type { PresetProperty } from 'storybook/internal/types';

export * from './types';

export const addons: PresetProperty<'addons'> = [
  require.resolve('@storybook/preset-vue3-webpack/framework-preset-vue3'),
  require.resolve('@storybook/preset-vue3-webpack/framework-preset-vue3-docs'),
];
