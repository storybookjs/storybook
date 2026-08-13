import type { DocgenPayload } from '../../services/docgen/types.ts';
import type { StoryDocsPayload } from '../../services/story-docs/types.ts';
import type { MdxPayload } from './map.ts';

export type DocsClassification = {
  /** Component ids present in docgen and/or story-docs aggregates. */
  componentIds: string[];
  /** Component ids backed by a story-docs payload. */
  storyBasedIds: Set<string>;
  /** Standalone MDX docs keyed by docs id → display name. */
  unattachedDocs: Map<string, string>;
  /** Attached MDX docs ids grouped by owning component id. */
  attachedDocsByComponent: Map<string, string[]>;
};

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
}): DocsClassification {
  const storyBasedIds = new Set(Object.keys(allStoryDocs));
  const unattachedDocs = new Map<string, string>();
  const attachedDocsByComponent = new Map<string, string[]>();
  const componentIds = new Set([...Object.keys(allDocgen), ...Object.keys(allStoryDocs)]);

  for (const [id, payload] of Object.entries(allMdx)) {
    if (!payload) {
      continue;
    }
    if (payload.docs[id]) {
      unattachedDocs.set(id, payload.docs[id].name);
      continue;
    }
    componentIds.add(id);
    attachedDocsByComponent.set(id, Object.keys(payload.docs));
  }

  return {
    componentIds: [...componentIds].sort(),
    storyBasedIds,
    unattachedDocs,
    attachedDocsByComponent,
  };
}
