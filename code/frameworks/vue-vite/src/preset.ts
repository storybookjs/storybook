import { dirname, join } from 'path';
import type { PresetProperty } from '@storybook/types';
import { mergeConfig } from 'vite';
import type { StorybookConfig } from './types';
import { vueDocgen } from './plugins/vue-docgen';

const getAbsolutePath = <I extends string>(input: I): I =>
  dirname(require.resolve(join(input, 'package.json'))) as any;

export const core: PresetProperty<'core', StorybookConfig> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: getAbsolutePath('@storybook/builder-vite'),
      options: typeof framework === 'string' ? {} : framework?.options.builder || {},
    },
    renderer: getAbsolutePath('@storybook/vue'),
  };
};

export const viteFinal: StorybookConfig['viteFinal'] = async (config, { presets }) => {
  return mergeConfig(config, {
    plugins: [vueDocgen()],
    resolve: {
      alias: {
        vue: 'vue/dist/vue.esm.js',
      },
    },
  });
};
