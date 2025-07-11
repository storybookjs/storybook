import type { PresetProperty } from 'storybook/internal/types';

export const core: PresetProperty<'core'> = {
  builder: require.resolve('@storybook/builder-vite'),
  renderer: require.resolve('@storybook/web-components/preset'),
};
