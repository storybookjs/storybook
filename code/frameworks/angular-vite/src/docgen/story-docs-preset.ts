import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { StoryDocsProviderPreset } from 'storybook/internal/types';

import { AngularComponentMetaManager } from '@storybook/angular-cm';
import { buildStoryDocsPayload } from './story-docs-build.ts';
import type { FrameworkOptions } from '../types.ts';

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
 * Angular story-docs provider: per-story template snippets plus story JSDoc descriptions for the
 * Code panel, docs Source/Description blocks, and static story-docs snapshots. Runs in the main
 * process (CSF parsing is cheap; selector/IO extraction reuses one warm analyzer). Merged with
 * downstream via the documented `{ ...downstream, ...ours }` spread idiom.
 *
 * Known cost: the analyzer below is a second TypeScript program in the dev-server process, on top
 * of the one the docgen worker owns in its own thread, and TypeScript programs are the largest
 * objects in the system. Reading the docgen service's payload instead would remove it, but not yet:
 * a snippet needs the component selector and its input/output names, which the payload carries
 * under `angularComponentMeta`, plus the values of the enums a story's args reference, which it
 * does not - without them `Kind.Secondary` inlines verbatim instead of resolving to `'secondary'`.
 * Delete this manager once those enums ride along on the docgen payload.
 *
 * No `startWatching()`: `extract` stats its cached snapshots per call, which keeps the story-file
 * driven re-extractions the module-graph subscription issues fresh without main-process watchers.
 */
export const experimental_storyDocsProvider: StoryDocsProviderPreset = async (
  nextStoryDocs,
  options
) => {
  // Scoped to the composed chain rather than the module, so the manager has exactly one owner and
  // one lifetime. Created lazily on the first eligible entry.
  let managerPromise: Promise<AngularComponentMetaManager | undefined> | undefined;

  const { snippetFormat } =
    (await options.presets.apply<FrameworkOptions | null>('frameworkOptions')) ?? {};

  return async (input) => {
    const storyImportPath = getStoryImportPathFromEntry(input.entry);
    if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
      return nextStoryDocs(input);
    }

    const manager = await (managerPromise ??= createManager());
    const ours = buildStoryDocsPayload(input, {
      manager,
      ...(snippetFormat === undefined ? {} : { snippetFormat }),
    });
    // The language service holds large type caches; check heap pressure after each extraction.
    manager?.recycleIfHeapPressured();

    if (!ours) {
      return nextStoryDocs(input);
    }
    const downstream = await nextStoryDocs(input);
    return { ...downstream, ...ours };
  };
};
