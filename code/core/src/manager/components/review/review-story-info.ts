import type { API_IndexHash, StatusesByStoryIdAndTypeId } from 'storybook/internal/types';
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

export const buildStoryInfo = (
  state: ReviewState,
  index: API_IndexHash | undefined,
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
      const direct = index?.[storyId];
      const entry =
        direct?.type === 'story' ? direct : index ? api.findLeafEntry(index, storyId) : undefined;
      const shared = {
        isNewlyAdded: newlyAddedStoryIds.has(storyId) || undefined,
        changeStatus: getStoryChangeStatus(allStatuses, storyId),
      };
      if (entry?.type === 'story' && entry.title) {
        info[storyId] = {
          title: entry.title,
          name: entry.name,
          ...shared,
        };
      } else {
        info[storyId] = {
          ...fallbackStoryInfo(storyId),
          ...shared,
        };
      }
    }
  }
  return info;
};
