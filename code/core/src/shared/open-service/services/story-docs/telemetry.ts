import { isEligibleStoryEntry } from '../../../../common/utils/select-component-entry.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import type { StoryDocsServiceState } from './definition.ts';

/**
 * Story-snippet outcomes of `core/story-docs`, sent with the `build` telemetry event. The three
 * ratios share the index stories as denominator and never overlap; the rest has a full snippet.
 */
export type StoryDocsTelemetry = {
  /** Share of index stories without story docs, or whose snippet provider failed. */
  errorRatio: number;
  /** Share of index stories whose story docs carry no static snippet. */
  noSnippetRatio: number;
  /** Share of index stories with a partial snippet. */
  warningRatio: number;
};

/**
 * Measures story-snippet outcomes against every story of the index, since a provider that fails on
 * a component leaves no story docs behind; `undefined` when the index has no story.
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
  let errorCount = 0;
  let noSnippetCount = 0;
  let warningCount = 0;
  for (const id of storyIds) {
    const storyDoc = storyDocs.get(id);
    if (!storyDoc || storyDoc.error) {
      errorCount++;
    } else if (storyDoc.snippet === undefined) {
      noSnippetCount++;
    } else if (storyDoc.warning !== undefined) {
      warningCount++;
    }
  }

  return {
    errorRatio: errorCount / storyIds.length,
    noSnippetRatio: noSnippetCount / storyIds.length,
    warningRatio: warningCount / storyIds.length,
  };
}
