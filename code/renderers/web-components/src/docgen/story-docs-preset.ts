import { fileURLToPath } from 'node:url';

import { createWorkerGatedStoryDocsProvider, getService } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';

import type { WebComponentsDocgenPayload } from './component-docgen/build-docgen.ts';
import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';
import { buildStoryDocsPayload } from './story-docs/build-story-docs.ts';

let warnedMissingDocgenService = false;

const getDocgenPayload = async (
  componentId: string
): Promise<WebComponentsDocgenPayload | undefined> => {
  try {
    const docgenService = getService('core/docgen', { internal: true });
    return await docgenService.queries.docgen.loaded({ id: componentId });
  } catch (error) {
    if (!warnedMissingDocgenService) {
      warnedMissingDocgenService = true;
      logger.warn(
        `Web Components story snippets are unavailable: querying core/docgen failed. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return undefined;
  }
};

export const experimental_storyDocsProvider = createWorkerGatedStoryDocsProvider({
  label: 'Web Components',
  docgenWorker: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)),
  build: (input) => buildStoryDocsPayload(input, { getDocgenPayload }),
});
