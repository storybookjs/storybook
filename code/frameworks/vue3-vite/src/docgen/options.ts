import type { Options } from 'storybook/internal/types';

import type { FrameworkOptions, VueDocgenPlugin } from '../types.ts';

export const VUE_COMPONENT_META = 'vue-component-meta' satisfies VueDocgenPlugin;

export const VUE_DOCGEN_API_DEPRECATION =
  `\`vue-docgen-api\` is deprecated and will be removed in Storybook 12. It is still the default docgen engine, so this also applies when you have not set the \`docgen\` framework option. ` +
  `Switch to \`vue-component-meta\`, with \`framework: { name: '@storybook/vue3-vite', options: { docgen: 'vue-component-meta' } }\` in your \`.storybook/main.ts\`.`;

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
