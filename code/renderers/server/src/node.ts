import { defineRenderer } from '@storybook/core';

import { getEntryPreview, serverIndexer } from './indexer.ts';

/** Configure server rendering and the JSON and YAML story indexer. */
export const server = defineRenderer<void>(() => ({
  meta: { name: '@storybook/server' },
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [getEntryPreview()]);
    storybook.hook(
      'index:indexers:collect',
      (existing) => [serverIndexer, ...(existing ?? [])],
      'reduce'
    );
  },
}));

export default server;
