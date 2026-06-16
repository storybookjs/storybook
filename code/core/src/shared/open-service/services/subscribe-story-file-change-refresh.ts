import {
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
} from '../../../common/utils/select-component-entry.ts';
import type { StoryIndex } from '../../../types/modules/indexer.ts';
import type { ModuleGraphService } from './module-graph/definition.ts';
import { toStoryIndexPath } from './module-graph/types.ts';

export type StoryFileChangeRefreshOptions = {
  workingDir: string;
  getIndex: () => Promise<StoryIndex>;
  hasExtractedPayload: (componentId: string) => boolean;
  refreshComponent: (componentId: string) => Promise<unknown>;
};

/**
 * Subscribes to module-graph story changes and re-extracts open-service payloads for affected
 * components that already have cached data. Shared by `core/docgen` and `core/story-docs`, each
 * passing its own `hasExtractedPayload` / `refreshComponent` hooks.
 *
 * `getLatestStoryChanges` reports `{ revision, storyFiles }`. The revision is the authoritative
 * "something changed" trigger; `storyFiles` is an optimization hint that is sometimes legitimately
 * empty: a story-index invalidation (a story renamed/reordered within a file, or a story-file edit
 * whose change set `_bumpGraphRevision` reset) advances the revision without naming the affected
 * stories. When the hint is empty we can't target a component, so we refresh every already-extracted
 * one; when it is populated we refresh only the components mapped from those story files.
 */
export function subscribeStoryFileChangeRefresh(
  moduleGraph: ModuleGraphService,
  options: StoryFileChangeRefreshOptions
) {
  const refreshExtracted = async (componentIds: Iterable<string>) => {
    const idsToRefresh = Array.from(componentIds).filter((id) => options.hasExtractedPayload(id));
    if (idsToRefresh.length === 0) {
      return;
    }
    await Promise.all(
      idsToRefresh.map((id) => options.refreshComponent(id).catch(() => undefined))
    );
  };

  moduleGraph.queries.getLatestStoryChanges.subscribe(
    undefined,
    async ({ revision, storyFiles }) => {
      // Revision 0 is the initial baseline snapshot, not a change.
      if (revision === 0) {
        return;
      }

      const componentEntries = selectComponentEntriesByComponentId(
        Object.values((await options.getIndex()).entries)
      );

      // Empty change set with an advanced revision: affected component(s) unknown, refresh all.
      if (storyFiles.length === 0) {
        await refreshExtracted(componentEntries.keys());
        return;
      }

      const componentEntryCandidates = Array.from(componentEntries)
        .map(([id, entry]) => {
          const storyFilePath = getStoryImportPathFromEntry(entry);
          if (!storyFilePath) {
            return undefined;
          }
          return {
            id,
            storyIndexPath: toStoryIndexPath(storyFilePath, options.workingDir),
          };
        })
        .filter((candidate) => candidate !== undefined);

      const bumpedComponentIds = new Set<string>();
      for (const storyFile of storyFiles) {
        const componentEntry = componentEntryCandidates.find(
          (candidate) => candidate.storyIndexPath === storyFile
        );
        if (!componentEntry) {
          continue;
        }
        bumpedComponentIds.add(componentEntry.id);
      }

      await refreshExtracted(bumpedComponentIds);
    }
  );
}
