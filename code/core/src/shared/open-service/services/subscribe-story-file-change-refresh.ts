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
 * Subscribes to module-graph story file changes and re-extracts open-service payloads for
 * affected components that already have cached data. Shared by `core/docgen` and `core/story-docs`,
 * each passing its own `hasExtractedPayload` / `refreshComponent` hooks.
 */
export function subscribeStoryFileChangeRefresh(
  moduleGraph: ModuleGraphService,
  options: StoryFileChangeRefreshOptions
) {
  moduleGraph.queries.getLatestStoryChanges.subscribe(undefined, async ({ storyFiles }) => {
    if (storyFiles.length === 0) {
      return;
    }

    const index = await options.getIndex();
    const indexEntries = Object.values(index.entries);
    const bumpedComponentIds = new Set<string>();
    const componentEntryCandidates = Array.from(selectComponentEntriesByComponentId(indexEntries))
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

    for (const storyFile of storyFiles) {
      const componentEntry = componentEntryCandidates.find(
        (candidate) => candidate.storyIndexPath === storyFile
      );
      if (!componentEntry) {
        continue;
      }
      bumpedComponentIds.add(componentEntry.id);
    }

    const componentIdsToRefresh = Array.from(bumpedComponentIds).filter((id) =>
      options.hasExtractedPayload(id)
    );

    if (componentIdsToRefresh.length === 0) {
      return;
    }

    await Promise.all(
      componentIdsToRefresh.map((id) => options.refreshComponent(id).catch(() => undefined))
    );
  });
}
