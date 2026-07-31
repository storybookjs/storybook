import type { PresetProperty } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import { resolveDocgenOptions } from './docgen/options.ts';
import { type VueDocgenEngine, vueComponentMeta } from './plugins/vue-component-meta.ts';
import { vueDocgen } from './plugins/vue-docgen.ts';
import { templateCompilation } from './plugins/vue-template.ts';
import type { FrameworkOptions, StorybookConfig } from './types.ts';

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
  if (docgen !== false) {
    if (docgen.plugin === 'vue-component-meta') {
      const engine: VueDocgenEngine = await options.presets.apply('experimental_vueDocgenEngine');
      plugins.push(await vueComponentMeta(engine, docgen.tsconfig));
    } else {
      plugins.push(await vueDocgen());
    }
  }

  const { mergeConfig } = await import('vite');
  return mergeConfig(config, {
    plugins,
  });
};
