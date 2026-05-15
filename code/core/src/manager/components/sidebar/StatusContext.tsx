import { createContext, useContext } from 'react';

import type {
  Status,
  StatusValue,
  StatusesByStoryIdAndTypeId,
  StoryId,
} from 'storybook/internal/types';

import type { StoriesHash } from 'storybook/manager-api';

import type { Item } from '../../container/Sidebar.tsx';
import { getDescendantIds } from '../../utils/tree.ts';

export const StatusContext = createContext<{
  data: StoriesHash;
  allStatuses?: StatusesByStoryIdAndTypeId;
  groupDualStatus?: Record<StoryId, { test: Status; change: Status }>;
}>({ data: {} });

function hasStatusWorthReporting(
  groupDualStatus: Record<StoryId, { test: Status; change: Status }>,
  itemId: StoryId
) {
  return (
    ['status-value:new', 'status-value:modified', 'status-value:affected'].includes(
      groupDualStatus[itemId]?.change.value
    ) ||
    ['status-value:pending', 'status-value:warning', 'status-value:error'].includes(
      groupDualStatus[itemId]?.test.value
    )
  );
}

export const useStatusSummary = (item: Item) => {
  const { data, allStatuses, groupDualStatus } = useContext(StatusContext);
  const summary: {
    counts: Record<StatusValue, number>;
    statusesByValue: Record<StatusValue, Record<StoryId, Status[]>>;
  } = {
    counts: {
      'status-value:pending': 0,
      'status-value:success': 0,
      'status-value:new': 0,
      'status-value:modified': 0,
      'status-value:affected': 0,
      'status-value:error': 0,
      'status-value:warning': 0,
      'status-value:unknown': 0,
    },
    statusesByValue: {
      'status-value:pending': {},
      'status-value:success': {},
      'status-value:new': {},
      'status-value:modified': {},
      'status-value:affected': {},
      'status-value:error': {},
      'status-value:warning': {},
      'status-value:unknown': {},
    },
  };

  if (data && allStatuses && groupDualStatus && hasStatusWorthReporting(groupDualStatus, item.id)) {
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
