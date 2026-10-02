import type { Options } from 'storybook/internal/types';

import type { FrameworkOptions, VueDocgenPlugin } from '../types.ts';

export const VUE_COMPONENT_META = 'vue-component-meta' satisfies VueDocgenPlugin;

export const VUE_BUILDER_DOCGEN_DEPRECATION =
  `Builder docgen (the \`docgen\` option of \`@storybook/vue3-vite\`, with \`vue-docgen-api\` or \`vue-component-meta\`) is deprecated and will be removed in Storybook 12. ` +
  `It runs because \`features.docgenServer\` is off. Remove \`docgenServer: false\` from your \`.storybook/main.ts\` to use server-side docgen.`;

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
    docgenServerActive: features?.docgenServer === true,
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
