import type { DocsIndexEntry } from '../../../../types/modules/indexer.ts';

import type { DocgenPayload } from '../docgen/types.ts';
import type { StoryDocsPayload } from '../story-docs/types.ts';
import type { IndexClassification } from './classify-index.ts';
import type { MdxPayload } from './map.ts';

function toDocsIndexEntry(id: string, name: string): DocsIndexEntry {
  return {
    type: 'docs',
    id,
    name,
    title: name,
    importPath: '',
    storiesImports: [],
  };
}

/**
 * Visibility intentionally follows composed service payloads because this API has no story-index
 * dependency with which to reapply manifest filtering.
 */
export function classifyServices({
  allDocgen,
  allStoryDocs,
  allMdx,
}: {
  allDocgen: Record<string, DocgenPayload | undefined>;
  allStoryDocs: Record<string, StoryDocsPayload | undefined>;
  allMdx: Record<string, MdxPayload | undefined>;
}): IndexClassification {
  const storyBasedIds = new Set(Object.keys(allStoryDocs));
  const unattachedDocs = new Map<string, DocsIndexEntry>();
  const attachedDocsByComponent = new Map<string, DocsIndexEntry[]>();
  const componentIds = new Set([...Object.keys(allDocgen), ...Object.keys(allStoryDocs)]);

  for (const [id, payload] of Object.entries(allMdx)) {
    if (!payload) {
      continue;
    }
    if (payload.docs[id]) {
      unattachedDocs.set(id, toDocsIndexEntry(id, payload.docs[id].name));
      continue;
    }
    componentIds.add(id);
    attachedDocsByComponent.set(
      id,
      Object.entries(payload.docs).map(([docsId, docs]) => toDocsIndexEntry(docsId, docs.name))
    );
  }

  return {
    componentIds: [...componentIds].sort(),
    storyBasedIds,
    unattachedDocs,
    attachedDocsByComponent,
  };
}
