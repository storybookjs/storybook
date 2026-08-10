import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { StoryDocsProviderPreset } from 'storybook/internal/types';

import { AngularComponentMetaManager } from '@storybook/angular-cm';
import { buildStoryDocsPayload } from './story-docs-build.ts';

const createManager = async (): Promise<AngularComponentMetaManager | undefined> => {
  try {
    const typescript = await import('typescript');
    return new AngularComponentMetaManager(typescript.default ?? typescript);
  } catch (error) {
    logger.warn(
      `Angular story snippets are unavailable: the component meta analyzer could not be created. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return undefined;
  }
};

/**
 * Angular story-docs provider: per-story template snippets and story JSDoc, built in the main
 * process from the component meta analyzer.
 *
 * The analyzer is a second TypeScript program alongside the docgen worker's, needed only because a
 * snippet resolves the enum members a story's args reference and the docgen payload does not carry
 * enum values.
 */
export const experimental_storyDocsProvider: StoryDocsProviderPreset = async (nextStoryDocs) => {
  // Scoped to the composed chain rather than the module, so the manager has one owner and one
  // lifetime.
  let managerPromise: Promise<AngularComponentMetaManager | undefined> | undefined;

  return async (input) => {
    const storyImportPath = getStoryImportPathFromEntry(input.entry);
    if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
      return nextStoryDocs(input);
    }

    const manager = await (managerPromise ??= createManager());
    const ours = buildStoryDocsPayload(input, { manager });
    // The language service holds large type caches; check heap pressure after each extraction.
    manager?.recycleIfHeapPressured();

    if (!ours) {
      return nextStoryDocs(input);
    }
    const downstream = await nextStoryDocs(input);
    return { ...downstream, ...ours };
  };
};
