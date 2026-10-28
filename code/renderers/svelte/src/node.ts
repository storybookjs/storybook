import { defineRenderer } from '@storybook/core';
import type { Options } from '@storybook/core/internal/types';

import { withSvelteManifests } from './docgen/provider.ts';
import { experimental_storyDocsProvider } from './docgen/story-docs-provider.ts';
import { getPreviewAnnotations } from './preview-annotations.ts';
import type { SvelteTypes } from './types.ts';

export type { SvelteTypes } from './types.ts';

/** Configure Svelte rendering, annotations, indexing, and story docs. */
export const svelte = defineRenderer<void, SvelteTypes>(() => ({
  meta: { name: '@storybook/svelte' },
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', async () =>
      getPreviewAnnotations(
        Object.keys(await storybook.callHook('core:docs:extend', {})).length > 0
      )
    );
    storybook.hook('core:import-parsers:collect', async () => {
      const { svelteImportParser } = await import('./parsers/index.ts');
      return [svelteImportParser];
    });
    storybook.hook(
      'index:indexers:collect',
      async (value) => {
        const { createIndexer } = await import('./svelte-csf/indexer/index.ts');
        return [createIndexer(), ...(value ?? [])];
      },
      'reduce'
    );
    storybook.hook('core:story-docs-provider:extend', (value) =>
      // The provider reads the instance from its async context; options only serve the legacy path.
      experimental_storyDocsProvider(value ?? (async () => undefined), {} as Options)
    );
    storybook.hook('index:manifests:extend', (value) =>
      withSvelteManifests(value ?? {}, storybook.options.features)
    );
  },
}));

export default svelte;
