import { fileURLToPath } from 'node:url';

import { createWorkerGatedStoryDocsProvider } from 'storybook/internal/core-server';

import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';
import { buildStoryDocsPayload } from './story-docs/build-story-docs.ts';

/**
 * Vue renderer story-docs provider, enabled only when Vue's docgen worker is active.
 */
export const experimental_storyDocsProvider = createWorkerGatedStoryDocsProvider({
  label: 'Vue',
  docgenWorker: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)),
  build: (input) => buildStoryDocsPayload(input),
});
