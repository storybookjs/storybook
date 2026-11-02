import type { Options } from 'storybook/internal/types';

import type { FrameworkOptions } from '../types.ts';

export const SVELTE_BUILDER_DOCGEN_DEPRECATION =
  'Builder docgen (the `docgen` option of `@storybook/svelte-vite` and `@storybook/sveltekit`) is deprecated and will be removed in Storybook 12. ' +
  'It runs because your Storybook main config sets `features.docgenServer: false`. Remove that setting to use server-side docgen.';

export async function resolveDocgenContext(options: Options) {
  const [frameworkOptions, features] = await Promise.all([
    options.presets.apply<FrameworkOptions | null>('frameworkOptions'),
    options.presets.apply('features', {}),
  ]);

  return {
    docgen: frameworkOptions?.docgen !== false,
    docgenServerActive: features?.docgenServer === true,
  };
}
