import { createContext, useContext } from 'react';

import type { StoriesHash } from 'storybook/internal/manager-api';
import type { StoryId } from 'storybook/internal/types';
import type { Status, StatusValueType, StatusesByStoryIdAndTypeId } from 'storybook/internal/types';

import type { Item } from '../../container/Sidebar';
import { getDescendantIds } from '../../utils/tree';

export const StatusContext = createContext<{
  data?: StoriesHash;
  allStatuses?: StatusesByStoryIdAndTypeId;
  groupStatus?: Record<StoryId, StatusValueType>;
}>({});

export const useStatusSummary = (item: Item) => {
  const { data, allStatuses, groupStatus } = useContext(StatusContext);
  const summary: {
    counts: Record<StatusValueType, number>;
    statusesByValue: Record<StatusValueType, Record<StoryId, Status[]>>;
  } = {
    counts: { pending: 0, success: 0, error: 0, warn: 0, unknown: 0 },
    statusesByValue: { pending: {}, success: {}, error: {}, warn: {}, unknown: {} },
  };

  if (
    data &&
    allStatuses &&
    groupStatus &&
    ['pending', 'warn', 'error'].includes(groupStatus[item.id])
  ) {
    for (const storyId of getDescendantIds(data, item.id, false)) {
      for (const status of Object.values(allStatuses[storyId] ?? {})) {
        summary.counts[status.value]++;
        summary.statusesByValue[status.value][storyId] ??= [];
        summary.statusesByValue[status.value][storyId].push(status);
      }
    }
  }

  return summary;
};
