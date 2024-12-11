import { PresetProperty } from 'storybook/internal/types';

export * from './types';

export const addons: PresetProperty<'addons'> = [
  require.resolve('@storybook/preset-angular-webpack/dist/server/framework-preset-angular-cli'),
  require.resolve('@storybook/preset-angular-webpack/dist/server/framework-preset-angular-ivy'),
  require.resolve('@storybook/preset-angular-webpack/dist/server/framework-preset-angular-docs'),
];
