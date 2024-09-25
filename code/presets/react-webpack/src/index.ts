import type { PresetProperty } from 'storybook/internal/types';

export * from './types';

export const addons: PresetProperty<'addons'> = [
  require.resolve('@storybook/preset-react-webpack/dist/framework-preset-cra'),
  require.resolve('@storybook/preset-react-webpack/dist/framework-preset-react-docs'),
];
