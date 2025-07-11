import type { StorybookConfig } from './types';

export const core: StorybookConfig['core'] = {
  builder: require.resolve('@storybook/builder-vite'),
  renderer: require.resolve('@storybook/preact/preset'),
};

export const viteFinal: StorybookConfig['viteFinal'] = async (config) => {
  // TODO: Add docgen plugin per issue https://github.com/storybookjs/storybook/issues/19739
  return config;
};
