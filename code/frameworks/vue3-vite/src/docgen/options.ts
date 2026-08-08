import type { Options, StorybookConfigRaw } from 'storybook/internal/types';

import type { FrameworkOptions, VueDocgenPlugin } from '../types.ts';

export const VUE_COMPONENT_META = 'vue-component-meta' satisfies VueDocgenPlugin;

export type ResolvedDocgenOptions = false | { plugin: VueDocgenPlugin; tsconfig?: string };

export interface DocgenContext {
  docgen: ResolvedDocgenOptions;
  features: StorybookConfigRaw['features'];
  /**
   * Only true if the docgen server is active and the `vue-component-meta` plugin is selected.
   */
  docgenServerActive: boolean;
}

export async function resolveDocgenContext(options: Options): Promise<DocgenContext> {
  const [frameworkOptions, features] = await Promise.all([
    options.presets.apply<FrameworkOptions | null>('frameworkOptions'),
    options.presets.apply('features', {}),
  ]);
  const docgen = resolveDocgenOptions(frameworkOptions?.docgen);

  return {
    docgen,
    features,
    docgenServerActive:
      features?.experimentalDocgenServer === true &&
      docgen !== false &&
      docgen.plugin === VUE_COMPONENT_META,
  };
}

export function resolveDocgenOptions(docgen?: FrameworkOptions['docgen']): ResolvedDocgenOptions {
  if (docgen === false) {
    return false;
  }

  if (docgen === undefined || docgen === true) {
    return { plugin: 'vue-docgen-api' };
  }

  if (typeof docgen === 'string') {
    return { plugin: docgen };
  }

  return docgen;
}
