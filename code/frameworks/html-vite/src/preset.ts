import type { PresetProperty } from 'storybook/internal/types';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/html/preset'),
};
