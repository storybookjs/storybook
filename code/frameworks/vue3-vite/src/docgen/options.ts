import type { FrameworkOptions, VueDocgenPlugin } from '../types.ts';

export const VUE_COMPONENT_META = 'vue-component-meta' satisfies VueDocgenPlugin;

export const VUE_BUILDER_DOCGEN_DEPRECATION =
  `Builder docgen (the \`docgen\` option of \`@storybook/vue3-vite\`, with \`vue-docgen-api\` or \`vue-component-meta\`) is deprecated and will be removed in Storybook 12. ` +
  `It runs because \`features.docgenServer\` is off. Server-side docgen needs the \`typescript\` package: install it and remove any \`docgenServer: false\` from your \`.storybook/main.ts\`.`;

export type ResolvedDocgenOptions = false | { plugin: VueDocgenPlugin; tsconfig?: string };

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
