import { createLazyDocgenMiddleware, loadTypeScriptCompilerApi } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware } from 'storybook/internal/types';

import { SVELTE_DOCGEN_STORY_FILE_TEST_REGEXP } from './story-file.ts';

/**
 * Owns one {@link SvelteComponentMetaManager} for the worker's lifetime: one svelte2tsx program per
 * tsconfig, kept across components and kept fresh by its file watching.
 */
export const createDocgenProvider = (): DocgenMiddleware =>
  createLazyDocgenMiddleware({
    storyFileTest: SVELTE_DOCGEN_STORY_FILE_TEST_REGEXP,
    createManager: async () => {
      try {
        await loadTypeScriptCompilerApi(() => import('typescript'));
        const [{ SvelteComponentMetaManager }, { buildDocgenPayload }] = await Promise.all([
          import('./component-docgen/component-meta/svelte-project-manager.ts'),
          import('./component-docgen/build-docgen.ts'),
        ]);
        const componentMetaManager = new SvelteComponentMetaManager();
        componentMetaManager.startWatching();
        return { componentMetaManager, buildDocgenPayload };
      } catch (error) {
        logger.warn(
          `Svelte docgen is unavailable: its engine could not be loaded. ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return undefined;
      }
    },
    extract: async (context, input) => context.buildDocgenPayload(input, context),
  });
