import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

import type { StorybookConfig } from './types';

export const core: PresetProperty<'core'> = {
  builder: fileURLToPath(import.meta.resolve('@storybook/builder-vite')),
  renderer: fileURLToPath(import.meta.resolve('@storybook/preact/preset')),
};

export const viteFinal: StorybookConfig['viteFinal'] = async (config) => {
  // TODO: Add docgen plugin per issue https://github.com/storybookjs/storybook/issues/19739
  return config;
};
