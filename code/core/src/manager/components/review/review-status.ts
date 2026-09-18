import type { Status, StatusStoreByTypeId, StatusValue } from 'storybook/internal/types';
import { REVIEW_STATUS_TYPE_ID } from 'storybook/internal/types';

import type { ReviewState } from './review-state.ts';

export const REVIEWING_STATUS_VALUE = 'status-value:reviewing' as StatusValue;

export const collectReviewStoryIds = (review: ReviewState): Set<string> => {
  const storyIds = new Set<string>();
  for (const collection of review.collections) {
    for (const storyId of collection.storyIds) {
      storyIds.add(storyId);
    }
  }
  return storyIds;
};

const createReviewStatus = (storyId: string): Status => ({
  storyId,
  typeId: REVIEW_STATUS_TYPE_ID,
  value: REVIEWING_STATUS_VALUE,
  title: '',
  description: '',
  sidebarContextMenu: false,
});

/** Replace all review statuses with the active review's story ids. */
export const applyReviewStatuses = (
  statusStore: StatusStoreByTypeId,
  storyIds: Set<string>
): void => {
  statusStore.unset();
  if (storyIds.size > 0) {
    statusStore.set([...storyIds].map(createReviewStatus));
  }
};

export const clearReviewStatuses = (statusStore: StatusStoreByTypeId): void => {
  statusStore.unset();
};
