import { getComponentIdFromEntry } from '../../../../common/utils/component-id.ts';
import {
  getStoryImportPathFromEntry,
  isEligibleStoryEntry,
} from '../../../../common/utils/select-component-entry.ts';
import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { registerExtractionService } from '../extraction-service.server.ts';
import { storyDocsServiceDef } from './definition.ts';
import type { StoryDocsPayload, StoryDocsProvider } from './types.ts';

export type RegisterStoryDocsServiceOptions = {
  workingDir?: string;
  /**
   * Returns the current story index when a service needs it. Callers should bind this to a
   * pre-resolved generator so each call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /**
   * Fully composed story-docs provider chain from
   * `presets.apply('experimental_storyDocsProvider', ...)`.
   */
  storyDocsProvider: StoryDocsProvider;
};

/**
 * Sibling story entries sharing the winning entry's componentId: other CSF files collapsed onto
 * the same component by sharing a title. The selection in `selectComponentEntriesByComponentId`
 * can only represent one file per id, so without this their stories never reach `docs list`.
 */
function findSiblingStoryEntries(index: StoryIndex, entry: IndexEntry): IndexEntry[] {
  const componentId = getComponentIdFromEntry(entry);
  return Object.values(index.entries).filter(
    (candidate) =>
      candidate.id !== entry.id &&
      isEligibleStoryEntry(candidate) &&
      getComponentIdFromEntry(candidate) === componentId
  );
}

/**
 * Wraps the composed story-docs provider so a component's payload includes stories from every
 * CSF file sharing its componentId, not just the winning file. Docgen, props tables, and the
 * manifest keep the single-file rule; only the `stories` record is merged. On story-id
 * collisions the winning file's story wins, matching the precedence everywhere else.
 *
 * Sibling extractions run settled: a failing sibling must not discard the winning file's
 * stories the way an unguarded fan-out would.
 */
function withSiblingStoryMerge(
  provider: StoryDocsProvider,
  getIndex: () => Promise<StoryIndex>
): StoryDocsProvider {
  return async (input) => {
    const payload = await provider(input);
    if (!payload) {
      return payload;
    }
    const siblings = findSiblingStoryEntries(await getIndex(), input.entry);
    if (siblings.length === 0) {
      return payload;
    }
    const results = await Promise.allSettled(
      siblings.map((entry) => provider({ entry }))
    );
    const merged: StoryDocsPayload['stories'] = {};
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        Object.assign(merged, result.value.stories);
      }
    }
    Object.assign(merged, payload.stories);
    return { ...payload, stories: merged };
  };
}

/** Registers the `core/story-docs` open service against the process-global registry. */
export function registerStoryDocsService(options: RegisterStoryDocsServiceOptions) {
  return registerExtractionService(storyDocsServiceDef, {
    workingDir: options.workingDir ?? process.cwd(),
    getIndex: options.getIndex,
    provider: withSiblingStoryMerge(options.storyDocsProvider, options.getIndex),
    buildErrorPayload: ({ id, entry, error }) => ({
      id,
      name: entry.title,
      path: getStoryImportPathFromEntry(entry) ?? entry.importPath,
      stories: {},
      error,
    }),
    queryName: 'storyDocs',
    extractCommand: 'extractStoryDocs',
    extractAllCommand: 'extractAllStoryDocs',
  });
}
