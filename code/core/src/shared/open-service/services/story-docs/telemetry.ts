import { isEligibleStoryEntry } from '../../../../common/utils/select-component-entry.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import type { StoryDocsServiceState } from './definition.ts';

/** Story-snippet outcomes of `core/story-docs`, sent with the `build` telemetry event. */
export type StoryDocsTelemetry = {
  /** Share of index stories without story docs, or whose snippet provider failed. */
  errorRatio: number;
  /** Share of index stories with a partial snippet, or no static snippet at all. */
  warningRatio: number;
};

/**
 * Measures story-snippet errors and warnings against every story of the index, since a provider
 * that fails on a component leaves no story docs behind; `undefined` when the index has no story.
 */
export function summarizeStoryDocsForTelemetry(
  index: StoryIndex,
  snapshots: StoryDocsServiceState[]
): StoryDocsTelemetry | undefined {
  const storyIds = Object.values(index.entries)
    .filter(isEligibleStoryEntry)
    .map((entry) => entry.id);
  if (storyIds.length === 0) {
    return undefined;
  }

  const storyDocs = new Map(
    snapshots
      .flatMap((snapshot) => Object.values(snapshot.components))
      .flatMap((component) => Object.entries(component.stories))
  );
  const errorCount = storyIds.filter((id) => {
    const storyDoc = storyDocs.get(id);
    return !storyDoc || storyDoc.error;
  }).length;
  const warningCount = storyIds.filter((id) => storyDocs.get(id)?.warning !== undefined).length;

  return {
    errorRatio: errorCount / storyIds.length,
    warningRatio: warningCount / storyIds.length,
  };
}
