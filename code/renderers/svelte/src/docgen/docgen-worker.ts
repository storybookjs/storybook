import { createLazyDocgenMiddleware } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware } from 'storybook/internal/types';

import { SVELTE_DOCGEN_STORY_FILE_TEST_REGEXP } from './story-file.ts';

export const createDocgenProvider = (): DocgenMiddleware =>
  createLazyDocgenMiddleware({
    storyFileTest: SVELTE_DOCGEN_STORY_FILE_TEST_REGEXP,
    createManager: async () => {
      try {
        const [{ createDocgenCache }, { buildDocgenPayload }] = await Promise.all([
          import('./component-docgen/svelte2tsx/generate-docgen.ts'),
          import('./component-docgen/build-docgen.ts'),
        ]);
        return { cache: createDocgenCache(), buildDocgenPayload };
      } catch (error) {
        logger.warn(
          `Svelte docgen is unavailable: its engine could not be loaded. ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return undefined;
      }
    },
    extract: async (manager, input) => manager.buildDocgenPayload(input, manager),
  });
