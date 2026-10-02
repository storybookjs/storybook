import type { PresetProperty } from 'storybook/internal/types';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/web-components/preset'),
};

// Ensure Stencil's generated loader directory is copied to the static build output
// for web-components projects using Stencil. This fixes the issue where
// defineCustomElements() loads components lazily from the generated loader/
// directory, which was not included in the static build output.
export const staticDirs: PresetProperty<'staticDirs'> = [
  { from: 'loader', to: '/loader' },
];
