import { selectComponentEntriesByComponentId } from '../../../../common/utils/select-component-entry.ts';
import type { DocsIndexEntry, IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { Tag } from '../../../constants/tags.ts';

import { getComponentIdFromEntry } from '../../../../common/utils/component-id.ts';
export type IndexClassification = {
  /** Component ids selected with the same rules as core's manifest generator. */
  componentIds: string[];
  /** Component ids backed by a story entry (so they have a story-docs payload). */
  storyBasedIds: Set<string>;
  /** Attached docs index entries grouped by owning component id. */
  attachedDocsByComponent: Map<string, DocsIndexEntry[]>;
  /** Standalone docs index entries keyed by their own id. */
  unattachedDocs: Map<string, DocsIndexEntry>;
};

/** Classifies a story index the same way the in-process MCP manifest provider does. */
export function classifyIndex(index: StoryIndex): IndexClassification {
  const entries = Object.values(index.entries).filter(
    (entry): entry is IndexEntry => entry.tags?.includes(Tag.MANIFEST) ?? false
  );
  const selected = selectComponentEntriesByComponentId(entries);

  const storyBasedIds = new Set<string>();
  for (const [id, entry] of selected) {
    if (entry.type === 'story') {
      storyBasedIds.add(id);
    }
  }

  const attachedDocsByComponent = new Map<string, DocsIndexEntry[]>();
  const unattachedDocs = new Map<string, DocsIndexEntry>();
  for (const entry of entries) {
    if (entry.type !== 'docs') {
      continue;
    }
    if (entry.tags?.includes(Tag.UNATTACHED_MDX)) {
      unattachedDocs.set(entry.id, entry);
    } else if (entry.tags?.includes(Tag.ATTACHED_MDX)) {
      const componentId = getComponentIdFromEntry(entry);
      const list = attachedDocsByComponent.get(componentId) ?? [];
      list.push(entry);
      attachedDocsByComponent.set(componentId, list);
    }
  }

  return {
    componentIds: [...selected.keys()],
    storyBasedIds,
    attachedDocsByComponent,
    unattachedDocs,
  };
}
