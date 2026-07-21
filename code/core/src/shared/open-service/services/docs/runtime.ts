import type { StoryIndex } from 'storybook/internal/types';

import { OpenServiceDocsRuntimeMissingError } from '../../../../server-errors.ts';
import type { DocsIndexEntry } from '../../../../types/modules/indexer.ts';
import { classifyIndex, type IndexClassification } from './classify-index.ts';

export type DocsRuntime = {
  getIndex: () => Promise<StoryIndex>;
};

/** Plain-object form of {@link IndexClassification} safe for open-service state. */
export type StoredIndexClassification = {
  componentIds: string[];
  storyBasedIds: string[];
  attachedDocsByComponent: Record<string, DocsIndexEntry[]>;
  unattachedDocs: Record<string, DocsIndexEntry>;
};

let runtime: DocsRuntime | undefined;

/** Stores registration-time dependencies for `core/docs` query loads. */
export function setDocsRuntime(next: DocsRuntime): void {
  runtime = next;
}

/** Clears registration-time dependencies (tests). */
export function clearDocsRuntime(): void {
  runtime = undefined;
}

/** Returns the active docs runtime, or throws when `core/docs` was registered without one. */
export function getDocsRuntime(): DocsRuntime {
  if (!runtime) {
    throw new OpenServiceDocsRuntimeMissingError();
  }
  return runtime;
}

/** Classifies the current story index for a docs query load. */
export async function classifyDocsIndex(): Promise<IndexClassification> {
  return classifyIndex(await getDocsRuntime().getIndex());
}

export function storeClassification(
  classification: IndexClassification
): StoredIndexClassification {
  return {
    componentIds: classification.componentIds,
    storyBasedIds: [...classification.storyBasedIds],
    attachedDocsByComponent: Object.fromEntries(classification.attachedDocsByComponent),
    unattachedDocs: Object.fromEntries(classification.unattachedDocs),
  };
}

export function restoreClassification(stored: StoredIndexClassification): IndexClassification {
  return {
    componentIds: stored.componentIds,
    storyBasedIds: new Set(stored.storyBasedIds),
    attachedDocsByComponent: new Map(Object.entries(stored.attachedDocsByComponent)),
    unattachedDocs: new Map(Object.entries(stored.unattachedDocs)),
  };
}

/** Stable cache key so concurrent docs loads do not overwrite each other's classification. */
export function docsClassificationKey(
  operation: 'list' | 'show',
  input: { withStoryIds?: boolean } | { id: string }
): string {
  if (operation === 'list') {
    const withStoryIds = 'withStoryIds' in input ? (input.withStoryIds ?? false) : false;
    return `list:${withStoryIds ? '1' : '0'}`;
  }
  return `show:${(input as { id: string }).id}`;
}
