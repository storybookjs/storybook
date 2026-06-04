import { Tag } from '../../shared/constants/tags.ts';
import type { DocsIndexEntry, IndexEntry } from '../../types/modules/indexer.ts';

import { getComponentIdFromEntry } from './component-id.ts';

function isAttachedDocsEntry(
  entry: IndexEntry
): entry is DocsIndexEntry & { storiesImports: [string, ...string[]] } {
  return (
    entry.type === 'docs' &&
    entry.tags?.includes(Tag.ATTACHED_MDX) === true &&
    entry.storiesImports.length > 0
  );
}

function isEligibleStoryEntry(entry: IndexEntry): boolean {
  return entry.type === 'story' && entry.subtype === 'story';
}

/**
 * CSF story file path used for component resolution — the story entry's `importPath`, or the first
 * `storiesImports` entry for attached MDX docs (same rule as the React component manifest generator).
 */
export function getStoryImportPathFromEntry(entry: IndexEntry): string | undefined {
  if (entry.type === 'story') {
    return entry.importPath;
  }
  if (isAttachedDocsEntry(entry)) {
    return entry.storiesImports[0];
  }
  return undefined;
}

/**
 * Picks one index entry per componentId: story entries win; attached docs fill gaps only where no
 * story exists for that componentId.
 */
export function selectComponentEntriesByComponentId(
  indexEntries: IndexEntry[]
): Map<string, IndexEntry> {
  const entriesByComponentId = new Map<string, IndexEntry>();

  for (const entry of indexEntries) {
    if (!isEligibleStoryEntry(entry)) {
      continue;
    }
    entriesByComponentId.set(getComponentIdFromEntry(entry), entry);
  }

  for (const entry of indexEntries) {
    if (!isAttachedDocsEntry(entry)) {
      continue;
    }
    const componentId = getComponentIdFromEntry(entry);
    if (!entriesByComponentId.has(componentId)) {
      entriesByComponentId.set(componentId, entry);
    }
  }

  return entriesByComponentId;
}

/** Resolves the authoritative index entry for a componentId, or undefined when none is eligible. */
export function selectComponentEntryForComponentId(
  indexEntries: IndexEntry[],
  componentId: string
): IndexEntry | undefined {
  const storyEntry = indexEntries.find(
    (entry) => isEligibleStoryEntry(entry) && getComponentIdFromEntry(entry) === componentId
  );
  if (storyEntry) {
    return storyEntry;
  }

  return indexEntries.find(
    (entry) => isAttachedDocsEntry(entry) && getComponentIdFromEntry(entry) === componentId
  );
}
