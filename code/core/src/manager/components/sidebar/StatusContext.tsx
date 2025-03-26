import { createContext, useContext } from 'react';

import type {
  Status,
  StatusValue,
  StatusesByStoryIdAndTypeId,
  StoryId,
} from 'storybook/internal/types';

import type { StoriesHash } from 'storybook/manager-api';

import type { Item } from '../../container/Sidebar';
import { getDescendantIds } from '../../utils/tree';

export const StatusContext = createContext<{
  data?: StoriesHash;
  allStatuses?: StatusesByStoryIdAndTypeId;
  groupStatus?: Record<StoryId, StatusValue>;
}>({});

export const useStatusSummary = (item: Item) => {
  const { data, allStatuses, groupStatus } = useContext(StatusContext);
  const summary: {
    counts: Record<StatusValue, number>;
    statusesByValue: Record<StatusValue, Record<StoryId, Status[]>>;
  } = {
    counts: {
      'status-value:pending': 0,
      'status-value:success': 0,
      'status-value:error': 0,
      'status-value:warning': 0,
      'status-value:unknown': 0,
    },
    statusesByValue: {
      'status-value:pending': {},
      'status-value:success': {},
      'status-value:error': {},
      'status-value:warning': {},
      'status-value:unknown': {},
    },
  };

  if (
    data &&
    allStatuses &&
    groupStatus &&
    ['status-value:pending', 'status-value:warning', 'status-value:error'].includes(
      groupStatus[item.id]
    )
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
