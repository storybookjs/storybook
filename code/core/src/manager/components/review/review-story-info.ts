import type {
  API_IndexHash,
  API_PreparedStoryIndex,
  StatusesByStoryIdAndTypeId,
} from 'storybook/internal/types';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';
import type { API } from 'storybook/manager-api';

import { fallbackStoryInfo, type StoryChangeStatus, type StoryInfo } from './review-types.ts';
import type { ReviewState } from './review-state.ts';

const getStoryChangeStatus = (
  allStatuses: StatusesByStoryIdAndTypeId,
  storyId: string
): StoryChangeStatus | undefined => {
  const changeValue = Object.values(allStatuses[storyId] ?? {}).find(
    (status) => status.typeId === CHANGE_DETECTION_STATUS_TYPE_ID
  )?.value;
  if (changeValue === 'status-value:new') {
    return 'new';
  }
  if (changeValue === 'status-value:modified') {
    return 'modified';
  }
  return undefined;
};

export const buildNewlyAddedStoryIds = (
  state: ReviewState,
  allStatuses: StatusesByStoryIdAndTypeId
): Set<string> => {
  const ids = new Set<string>();
  const isChangeDetectedNew = (storyId: string) =>
    Object.values(allStatuses[storyId] ?? {}).some((status) => status.value === 'status-value:new');
  for (const collection of state.collections) {
    for (const storyId of collection.storyIds) {
      if (isChangeDetectedNew(storyId)) {
        ids.add(storyId);
      }
    }
  }
  return ids;
};

/**
 * Resolve a story's component title and display name the same way the sidebar
 * Explorer does — from the story's index entry, so a story's custom `name`/
 * `storyName` is honoured instead of a slug derived from its id.
 *
 * The unfiltered `internal_index` is consulted first: while in review mode the
 * sidebar `index` tree is filtered down to the reviewed stories, which can drop
 * entries and force the id-slug fallback. `internal_index` keeps every story's
 * resolved name regardless of the active filters. The filtered `index` (and its
 * `findLeafEntry` traversal) is the next best source, and the id-derived slug is
 * a true last resort used only before the index has loaded.
 */
const resolveStoryTitleAndName = (
  storyId: string,
  internalIndex: API_PreparedStoryIndex | undefined,
  index: API_IndexHash | undefined,
  api: API
): { title: string; name: string } => {
  const fromInternal = internalIndex?.entries[storyId];
  if (fromInternal?.type === 'story' && fromInternal.title) {
    return { title: fromInternal.title, name: fromInternal.name };
  }
  const direct = index?.[storyId];
  const entry =
    direct?.type === 'story' ? direct : index ? api.findLeafEntry(index, storyId) : undefined;
  if (entry?.type === 'story' && entry.title) {
    return { title: entry.title, name: entry.name };
  }
  return fallbackStoryInfo(storyId);
};

export const buildStoryInfo = (
  state: ReviewState,
  index: API_IndexHash | undefined,
  internalIndex: API_PreparedStoryIndex | undefined,
  api: API,
  allStatuses: StatusesByStoryIdAndTypeId,
  newlyAddedStoryIds: Set<string>
): Record<string, StoryInfo> => {
  const info: Record<string, StoryInfo> = {};
  for (const collection of state.collections) {
    for (const storyId of collection.storyIds) {
      if (storyId in info) {
        continue;
      }
      info[storyId] = {
        ...resolveStoryTitleAndName(storyId, internalIndex, index, api),
        isNewlyAdded: newlyAddedStoryIds.has(storyId) || undefined,
        changeStatus: getStoryChangeStatus(allStatuses, storyId),
      };
    }
  }
  return info;
};
