import type { PresetProperty } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import { vueComponentMeta } from './plugins/vue-component-meta.ts';
import { vueDocgen } from './plugins/vue-docgen.ts';
import { templateCompilation } from './plugins/vue-template.ts';
import type { FrameworkOptions, StorybookConfig, VueDocgenPlugin } from './types.ts';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/vue3/preset'),
};

export const viteFinal: StorybookConfig['viteFinal'] = async (config, options) => {
  const plugins: Plugin[] = [await templateCompilation()];

  const framework = await options.presets.apply('framework');
  const frameworkOptions: FrameworkOptions =
    typeof framework === 'string' ? {} : (framework.options ?? {});

  const docgen = resolveDocgenOptions(frameworkOptions.docgen);

  // add docgen plugin depending on framework option
  // from 10.5 on, vue-component-meta is default.
  if (docgen !== false) {
    if (docgen.plugin === 'vue-docgen-api') {
      plugins.push(await vueDocgen());
    } else {
      plugins.push(await vueComponentMeta(docgen.tsconfig));
    }
  }

  const { mergeConfig } = await import('vite');
  return mergeConfig(config, {
    plugins,
  });
};

/** Resolves the docgen framework option. */
const resolveDocgenOptions = (
  docgen?: FrameworkOptions['docgen']
): false | { plugin: VueDocgenPlugin; tsconfig?: string } => {
  if (docgen === false) {
    return false;
  }

  if (docgen === undefined || docgen === true) {
    return { plugin: 'vue-component-meta' };
  }

  if (typeof docgen === 'string') {
    return { plugin: docgen };
  }

  return docgen;
};
