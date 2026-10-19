import { createLazyDocgenMiddleware } from 'storybook/internal/common';
import type { DocgenMiddleware } from 'storybook/internal/types';

import { SVELTE_DOCGEN_STORY_FILE_TEST_REGEXP } from './story-file.ts';

export const createDocgenProvider = (): DocgenMiddleware =>
  createLazyDocgenMiddleware({
    storyFileTest: SVELTE_DOCGEN_STORY_FILE_TEST_REGEXP,
    createManager: async () => {
      try {
        import.meta.resolve('typescript');
      } catch {
        return undefined;
      }
      const [{ createDocgenCache }, { buildDocgenPayload }] = await Promise.all([
        import('./component-docgen/svelte2tsx/generate-docgen.ts'),
        import('./component-docgen/build-docgen.ts'),
      ]);
      return { cache: createDocgenCache(), buildDocgenPayload };
    },
    extract: async (manager, input) => manager.buildDocgenPayload(input, manager),
  });
