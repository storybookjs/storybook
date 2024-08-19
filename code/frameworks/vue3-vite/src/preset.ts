import { dirname, join } from 'node:path';

import type { PresetProperty } from 'storybook/internal/types';

import type { PluginOption } from 'vite';

import { vueComponentMeta } from './plugins/vue-component-meta';
import { vueDocgen } from './plugins/vue-docgen';
import type { FrameworkOptions, StorybookConfig, VueDocgenPlugin } from './types';

const getAbsolutePath = <I extends string>(input: I): I =>
  dirname(require.resolve(join(input, 'package.json'))) as any;

export const core: PresetProperty<'core'> = {
  builder: getAbsolutePath('@storybook/builder-vite'),
  renderer: getAbsolutePath('@storybook/vue3'),
};

export const viteFinal: StorybookConfig['viteFinal'] = async (config, options) => {
  const plugins: PluginOption[] = [];

  const framework = await options.presets.apply('framework');
  const frameworkOptions: FrameworkOptions =
    typeof framework === 'string' ? {} : framework.options ?? {};

  const docgen = resolveDocgenOptions(frameworkOptions.docgen);

  // add docgen plugin depending on framework option
  if (docgen.plugin === 'vue-component-meta') {
    plugins.push(await vueComponentMeta(docgen.tsconfig));
  } else {
    plugins.push(await vueDocgen());
  }

  const { mergeConfig } = await import('vite');
  return mergeConfig(config, {
    plugins,
    resolve: {
      alias: {
        vue: 'vue/dist/vue.esm-bundler.js',
      },
    },
  });
};

/** Resolves the docgen framework option. */
const resolveDocgenOptions = (
  docgen?: FrameworkOptions['docgen']
): { plugin: VueDocgenPlugin; tsconfig?: string } => {
  if (!docgen) {
    return { plugin: 'vue-docgen-api' };
  }

  if (typeof docgen === 'string') {
    return { plugin: docgen };
  }
  return docgen;
};
