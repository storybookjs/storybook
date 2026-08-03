import type { Options } from 'storybook/internal/types';

import type { FrameworkOptions, VueDocgenPlugin } from '../types.ts';

export type ResolvedDocgenOptions = false | { plugin: VueDocgenPlugin; tsconfig?: string };

export async function getFrameworkOptions(options: Options): Promise<FrameworkOptions> {
  const framework = await options.presets.apply('framework');
  return typeof framework === 'string' ? {} : (framework.options ?? {});
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
