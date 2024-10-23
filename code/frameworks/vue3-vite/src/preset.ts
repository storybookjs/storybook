import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

import type { PluginOption } from 'vite';

import { vueComponentMeta } from './plugins/vue-component-meta';
import { vueDocgen } from './plugins/vue-docgen';
import { templateCompilation } from './plugins/vue-template';
import type { FrameworkOptions, StorybookConfig, VueDocgenPlugin } from './types';

export const core: PresetProperty<'core'> = {
  builder: fileURLToPath(import.meta.resolve('@storybook/builder-vite')),
  renderer: fileURLToPath(import.meta.resolve('@storybook/vue3/preset')),
};

export const viteFinal: StorybookConfig['viteFinal'] = async (config, options) => {
  const plugins: PluginOption[] = [templateCompilation()];

  const framework = await options.presets.apply('framework');
  const frameworkOptions: FrameworkOptions =
    typeof framework === 'string' ? {} : (framework.options ?? {});

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
