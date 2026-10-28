import { deprecate } from '@storybook/core/internal/node-logger';

import type { InlineConfig, Plugin } from 'vite';

import {
  VUE_COMPONENT_META,
  VUE_BUILDER_DOCGEN_DEPRECATION,
  type ResolvedDocgenOptions,
} from './docgen/options.ts';
import { type VueDocgenEngine, vueComponentMeta } from './plugins/vue-component-meta.ts';
import { vueDocgen } from './plugins/vue-docgen.ts';
import { templateCompilation } from './plugins/vue-template.ts';

/** Add template compilation and, when server docgen is off, the builder docgen plugin. */
export async function withVueDocgen(
  config: InlineConfig,
  {
    docgen,
    docgenServerActive,
    disableDocgen,
    getEngine,
  }: {
    docgen: ResolvedDocgenOptions;
    docgenServerActive: boolean;
    disableDocgen: boolean | undefined;
    getEngine: () => Promise<VueDocgenEngine>;
  }
): Promise<InlineConfig> {
  const plugins: Plugin[] = [await templateCompilation()];

  // Test builds turn `docgenServer` off to skip docgen entirely, not to fall back to builder docgen.
  if (docgen !== false && !docgenServerActive && !disableDocgen) {
    deprecate(VUE_BUILDER_DOCGEN_DEPRECATION);
    const engine = await getEngine();
    if (docgen.plugin === VUE_COMPONENT_META) {
      plugins.push(await vueComponentMeta(engine, docgen.tsconfig));
    } else {
      plugins.push(await vueDocgen(engine));
    }
  }

  const { mergeConfig } = await import('vite');
  return mergeConfig(config, { plugins });
}
