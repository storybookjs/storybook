import { fileURLToPath } from 'node:url';

import { createWorkerGatedStoryDocsProvider } from 'storybook/internal/core-server';

import { buildStoryDocsPayload } from './story-docs/build-story-docs.ts';
import { SVELTE_STORY_FILE_TEST_REGEXP } from './story-file.ts';
import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';

export const experimental_storyDocsProvider = createWorkerGatedStoryDocsProvider({
  label: 'Svelte',
  docgenWorker: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)),
  storyFileTest: SVELTE_STORY_FILE_TEST_REGEXP,
  build: (input) => buildStoryDocsPayload(input),
});
