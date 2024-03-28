import type { PresetProperty } from '@storybook/types';
import { dirname, join } from 'path';
import type { StorybookConfig } from './types';
import { vite } from './type-annotation';

const getAbsolutePath = <I extends string>(input: I): I =>
  dirname(require.resolve(join(input, 'package.json'))) as any;

export const core: PresetProperty<'core'> = {
  builder: getAbsolutePath('@storybook/builder-vite'),
  renderer: getAbsolutePath('@storybook/preact'),
};

export const viteFinal: StorybookConfig['viteFinal'] = async (config) => {
  const { plugins = [] } = config;

  plugins.push(
    vite({
      rootDir: config.root ?? process.cwd(),
    })
  );

  return config;
};
