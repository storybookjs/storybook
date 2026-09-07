import type { Options } from 'storybook/internal/types';

import type { FrameworkOptions, VueDocgenPlugin } from '../types.ts';

export const VUE_COMPONENT_META = 'vue-component-meta' satisfies VueDocgenPlugin;

export const VUE_DOCGEN_API_DEPRECATION =
  `\`vue-docgen-api\` is deprecated and will be removed in the next major release of Storybook. It is still the default docgen engine, so this also applies when you have not set the \`docgen\` framework option. ` +
  `Enable server-side docgen with \`features: { experimentalDocgenServer: true }\` in your \`.storybook/main.ts\`, which becomes the default in Storybook 11, ` +
  `or set \`framework: { name: '@storybook/vue3-vite', options: { docgen: 'vue-component-meta' } }\` to keep docgen in the builder.`;

export type ResolvedDocgenOptions = false | { plugin: VueDocgenPlugin; tsconfig?: string };

export interface DocgenContext {
  docgen: ResolvedDocgenOptions;
  /** Whether server-side docgen is active. */
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
    docgenServerActive: features?.experimentalDocgenServer === true,
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
