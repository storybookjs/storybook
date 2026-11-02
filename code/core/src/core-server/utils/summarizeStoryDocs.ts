import { isExampleStoryId } from 'storybook/internal/telemetry';
import type { StoryIndex } from 'storybook/internal/types';

import { getComponentIdFromEntry } from '../../common/utils/component-id.ts';
import { isEligibleStoryEntry } from '../../common/utils/select-component-entry.ts';
import { loadStoryDocsPayloadsFromDisk } from './manifests/components-ref-manifest.ts';

export async function summarizeStoryDocs(storyIndex: StoryIndex, outputDir: string) {
  const storiesByComponentId = Map.groupBy(
    Object.values(storyIndex.entries).filter(
      (entry) => isEligibleStoryEntry(entry) && !isExampleStoryId(entry.id)
    ),
    getComponentIdFromEntry
  );
  const payloads = await loadStoryDocsPayloadsFromDisk(outputDir, [...storiesByComponentId.keys()]);

  const summary = { storyCount: 0, errorCount: 0, noSnippetCount: 0, warningCount: 0 };
  for (const [componentId, stories] of storiesByComponentId) {
    for (const story of stories) {
      summary.storyCount++;
      // No entry means the provider failed for the whole component, or returned nothing.
      const storyDoc = payloads[componentId]?.stories[story.id];
      if (!storyDoc || storyDoc.error) {
        summary.errorCount++;
      } else if (storyDoc.snippet === undefined) {
        summary.noSnippetCount++;
      } else if (storyDoc.warning !== undefined) {
        summary.warningCount++;
      }
    }
  }
  return summary;
}
