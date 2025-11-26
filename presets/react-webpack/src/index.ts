import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

export * from './types';

export const addons: PresetProperty<'addons'> = [
  fileURLToPath(import.meta.resolve('@storybook/preset-react-webpack/preset-cra')),
  fileURLToPath(import.meta.resolve('@storybook/preset-react-webpack/preset-react-docs')),
];
