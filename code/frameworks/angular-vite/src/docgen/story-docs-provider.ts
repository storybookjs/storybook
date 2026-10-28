import { fileURLToPath } from 'node:url';

import { createWorkerGatedStoryDocsProvider, getService } from '@storybook/core/internal/services';
import { logger } from '@storybook/core/internal/node-logger';

import type { AngularDocgenPayload } from './build-docgen.ts';
import { buildStoryDocsPayload } from './story-docs-build.ts';
import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';

let warnedMissingDocgenService = false;

const getDocgenPayload = async (componentId: string): Promise<AngularDocgenPayload | undefined> => {
  try {
    const docgenService = getService('core/docgen', { internal: true });
    return await docgenService.queries.docgen.loaded({ id: componentId });
  } catch (error) {
    if (!warnedMissingDocgenService) {
      warnedMissingDocgenService = true;
      logger.warn(
        `Angular story snippets are unavailable: querying core/docgen failed. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return undefined;
  }
};

/** Build Angular story snippets from the docgen worker's payload. */
export const angularStoryDocsProvider = createWorkerGatedStoryDocsProvider({
  label: 'Angular',
  docgenWorker: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)),
  build: (input) => buildStoryDocsPayload(input, { getDocgenPayload }),
});
