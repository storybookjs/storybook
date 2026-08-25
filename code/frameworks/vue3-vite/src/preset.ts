import { deprecate } from 'storybook/internal/node-logger';
import type { PresetProperty } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import {
  VUE_COMPONENT_META,
  VUE_DOCGEN_API_DEPRECATION,
  resolveDocgenContext,
} from './docgen/options.ts';
import { type VueDocgenEngine, vueComponentMeta } from './plugins/vue-component-meta.ts';
import { vueDocgen } from './plugins/vue-docgen.ts';
import { templateCompilation } from './plugins/vue-template.ts';
import type { StorybookConfig } from './types.ts';

export { experimental_docgenProvider, experimental_manifests } from './docgen/preset.ts';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/vue3/preset'),
};

export const viteFinal: StorybookConfig['viteFinal'] = async (config, options) => {
  const plugins: Plugin[] = [await templateCompilation()];

  const { docgen, docgenServerActive } = await resolveDocgenContext(options);

  // add docgen plugin depending on framework option
  if (docgen !== false && !docgenServerActive) {
    const engine: VueDocgenEngine = await options.presets.apply('experimental_vueDocgenEngine');
    if (docgen.plugin === VUE_COMPONENT_META) {
      plugins.push(await vueComponentMeta(engine, docgen.tsconfig));
    } else {
      deprecate(VUE_DOCGEN_API_DEPRECATION);
      plugins.push(await vueDocgen(engine));
    }
  }

  const { mergeConfig } = await import('vite');
  return mergeConfig(config, {
    plugins,
  });
};
