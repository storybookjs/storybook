import { createLazyDocgenMiddleware } from 'storybook/internal/common';
import type { DocgenMiddleware } from 'storybook/internal/types';

import { buildDocgenPayload } from './component-docgen/build-docgen.ts';
import { SVELTE_STORY_FILE_TEST_REGEXP } from './story-file.ts';

export const createDocgenProvider = (): DocgenMiddleware =>
  createLazyDocgenMiddleware({
    storyFileTest: SVELTE_STORY_FILE_TEST_REGEXP,
    // TODO: return the ported svelte2tsx docgen cache so it stays warm across components.
    createManager: async () => ({}),
    extract: async (_manager, input) => buildDocgenPayload(input),
  });
