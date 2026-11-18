import { logger } from 'storybook/internal/node-logger';

import {
  STORY_FILE_TEST_REGEXP,
  getStoryImportPathFromEntry,
} from '../../../../common/utils/select-component-entry.ts';
import type { DocgenProviderDescriptor } from '../docgen/types.ts';
import type {
  StoryDocsPayload,
  StoryDocsProvider,
  StoryDocsProviderInput,
  StoryDocsProviderPreset,
} from './types.ts';

export interface WorkerGatedStoryDocsProviderOptions {
  /** Name shown in the debug log when a story file cannot be read, such as `Vue`. */
  label: string;
  /** Absolute path of the docgen worker module that must be registered for this provider to run. */
  docgenWorker: string;
  /** Story files this provider reads. Defaults to CSF story files. */
  storyFileTest?: RegExp;
  /** Reads one story file; `undefined` hands the story to the next provider. */
  build: (input: StoryDocsProviderInput) => Promise<StoryDocsPayload | undefined>;
}

/**
 * Create an `experimental_storyDocsProvider` preset that only runs when the renderer's docgen worker
 * is registered, and merges its payload over the next provider's.
 *
 * A story file the provider cannot read falls back to the next provider and is logged at debug level.
 */
export function createWorkerGatedStoryDocsProvider({
  label,
  docgenWorker,
  storyFileTest = STORY_FILE_TEST_REGEXP,
  build,
}: WorkerGatedStoryDocsProviderOptions): StoryDocsProviderPreset {
  return async (nextStoryDocs, options): Promise<StoryDocsProvider> => {
    const descriptors = await options.presets.apply<DocgenProviderDescriptor[]>(
      'experimental_docgenProvider',
      []
    );
    if (!descriptors.some((descriptor) => descriptor.moduleSpecifier === docgenWorker)) {
      return nextStoryDocs;
    }

    return async (input) => {
      const storyImportPath = getStoryImportPathFromEntry(input.entry);
      if (!storyImportPath || !storyFileTest.test(storyImportPath)) {
        return nextStoryDocs(input);
      }

      let ours: StoryDocsPayload | undefined;
      try {
        ours = await build(input);
      } catch (error) {
        logger.debug(
          `${label} story snippets are unavailable for ${storyImportPath}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return nextStoryDocs(input);
      }

      if (!ours) {
        return nextStoryDocs(input);
      }
      return { ...(await nextStoryDocs(input)), ...ours };
    };
  };
}
