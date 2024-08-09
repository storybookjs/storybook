import type { PresetProperty } from 'storybook/internal/types';

import { dirname, join } from 'path';

import type { StorybookConfig } from './types';

const getAbsolutePath = <I extends string>(input: I): I =>
  dirname(require.resolve(join(input, 'package.json'))) as any;

export const core: PresetProperty<'core'> = {
  builder: getAbsolutePath('@storybook/builder-vite'),
  renderer: getAbsolutePath('@storybook/preact'),
};

export const viteFinal: StorybookConfig['viteFinal'] = async (config) => {
  // TODO: Add docgen plugin per issue https://github.com/storybookjs/storybook/issues/19739
  return config;
};
