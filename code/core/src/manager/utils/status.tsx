import type { ReactElement } from 'react';
import React from 'react';

import type { API_IndexHash, Status, StatusValue } from 'storybook/internal/types';
import {
  CHANGE_DETECTION_STATUS_TYPE_ID,
  NON_AGGREGATED_STATUS_TYPE_IDS,
  REVIEW_STATUS_TYPE_ID,
  type API_HashEntry,
  type StatusesByStoryIdAndTypeId,
} from 'storybook/internal/types';

import { StatusFailIcon, StatusPassIcon, StatusWarnIcon, SyncIcon } from '@storybook/icons';

import memoizerific from 'memoizerific';
import { transparentize } from 'polished';
import type { Theme } from 'storybook/theming';

import { UseSymbol } from '../components/sidebar/IconSymbols.tsx';

export interface StatusMapping {
  icon: ReactElement | null;
  textColor: string | null;
}

export const statusPriority: StatusValue[] = [
  'status-value:unknown',
  'status-value:pending',
  'status-value:success',
  'status-value:affected',
  'status-value:reviewing',
  'status-value:modified',
  'status-value:new',
  'status-value:warning',
  'status-value:error',
];

// We might not want to make this a hook because it is used in the Tree after multiple returns.
// There could be scenarios where creating a story changes the type of an item (e.g. story now
// has children because it has a test child), so we could end up with rule of hooks violations.
export const getStatus = memoizerific(10)((theme: Theme, status: StatusValue): StatusMapping => {
  const defaultIconColor =
    theme.base === 'light'
      ? transparentize(0.3, theme.color.defaultText)
      : transparentize(0.6, theme.color.defaultText);

  const statusMapping: Record<StatusValue, StatusMapping> = {
    'status-value:unknown': {
      icon: null,
      textColor: null,
    },
    'status-value:pending': {
      icon: <SyncIcon size={14} color={defaultIconColor} />,
      textColor: 'currentColor',
    },
    'status-value:success': {
      icon: <StatusPassIcon color={theme.color.positive} />,
      textColor: 'currentColor',
    },
    'status-value:new': {
      icon: (
        <svg viewBox="0 0 14 14" width="14" height="14" style={{ color: theme.fgColor.accent }}>
          <UseSymbol type="change-new" />
        </svg>
      ),
      textColor: null,
    },
    'status-value:modified': {
      icon: (
        <svg viewBox="0 0 14 14" width="14" height="14" style={{ color: theme.fgColor.accent }}>
          <UseSymbol type="change-modified" />
        </svg>
      ),
      textColor: null,
    },
    'status-value:affected': {
      icon: (
        <svg viewBox="0 0 14 14" width="14" height="14" style={{ color: theme.fgColor.accent }}>
          <UseSymbol type="change-affected" />
        </svg>
      ),
      textColor: null,
    },
    'status-value:reviewing': {
      icon: (
        <svg viewBox="0 0 14 14" width="14" height="14" style={{ color: theme.fgColor.agentic }}>
          <UseSymbol type="reviewing" />
        </svg>
      ),
      textColor: null,
    },
    'status-value:warning': {
      icon: <StatusWarnIcon size={14} color={theme.color.warning} />,
      textColor: theme.fgColor.warning,
    },
    'status-value:error': {
      icon: <StatusFailIcon color={theme.color.negative} />,
      textColor: theme.fgColor.negative,
    },
  };
  return statusMapping[status];
});

/**
 * Whether a row should surface its change-detection icon (vs. falling back to the test icon).
 * Shared by the sidebar tree and the status helpers so the decision lives in exactly one place.
 */
export const shouldShowChangeStatus = (
  changeStatus: StatusValue,
  isModifiedFilterActive: boolean
): boolean =>
  changeStatus !== 'status-value:unknown' &&
  changeStatus !== 'status-value:affected' &&
  (changeStatus !== 'status-value:modified' || isModifiedFilterActive);

/** A status that contributes to the aggregated test status (i.e. not a quality/meta status). */
const isAggregatedTestStatus = (status: { typeId: string }): boolean =>
  !NON_AGGREGATED_STATUS_TYPE_IDS.includes(status.typeId);

export const getMostCriticalStatusValue = (statusValues: StatusValue[]): StatusValue => {
  return statusPriority.findLast((value) => statusValues.includes(value)) || 'status-value:unknown';
};

// Drop the review (reviewing) status type. Unlike the aggregated test status, the single group
// aggregate (getGroupStatus) intentionally keeps change-detection so a group still surfaces a
// modified/new indicator; only review is meaningless at that level.
const statusesExcludingReview = <T extends { typeId: string }>(statuses: T[]): T[] =>
  statuses.filter((status) => status.typeId !== REVIEW_STATUS_TYPE_ID);

/**
 * Compute one merged status value for every ancestor row, in a single bottom-up pass.
 *
 * For each story leaf, find the most critical status. Then walk up the parent chain and promote
 * the status of each ancestor when the leaf status is more critical.
 *
 * Coverage differs from {@link getGroupDualStatus}: this function reads story leaves only, writes
 * to the ancestors of a leaf and never to the leaf's own row, and does include root rows.
 */
export function getGroupStatus(
  index: {
    [x: string]: Partial<API_HashEntry>;
  },
  allStatuses: StatusesByStoryIdAndTypeId
): Record<string, StatusValue> {
  const result: Record<string, StatusValue> = {};

  for (const item of Object.values(index)) {
    if (item.type !== 'story') {
      continue;
    }

    const storyStatuses = allStatuses[item.id!];
    if (!storyStatuses) {
      continue;
    }

    const leafStatus = getMostCriticalStatusValue(
      statusesExcludingReview(Object.values(storyStatuses)).map((s) => s.value)
    );

    let currentItem: Partial<API_HashEntry> | undefined = item;
    while (currentItem) {
      const pid: string | undefined =
        'parent' in currentItem ? (currentItem.parent as string | undefined) : undefined;
      if (!pid) {
        break;
      }

      const existing = result[pid];
      if (!existing || statusPriority.indexOf(leafStatus) > statusPriority.indexOf(existing)) {
        result[pid] = leafStatus;
      }

      currentItem = index[pid];
    }
  }

  return result;
}

/**
 * Compute the change-detection status and the test status for every row, in a single bottom-up
 * pass. The statuses of a story or docs entry apply to its own row. They also roll up to every
 * ancestor of that row.
 *
 * Review statuses are excluded from both slots. A review status is neither a test result nor a
 * change-detection result. `isAggregatedTestStatus` applies the same rule.
 *
 * Coverage differs from {@link getGroupStatus}: this function reads story and docs leaves, writes
 * to the leaf's own row as well as to its ancestors, and never writes to a root row.
 */
export function getGroupDualStatus(
  index: API_IndexHash,
  allStatuses: StatusesByStoryIdAndTypeId
): Record<string, { change: Status; test: Status }> {
  const result: Record<string, { change: Status; test: Status }> = {};

  const promote = (id: string, status: Status, slot: 'change' | 'test') => {
    // Root rows never display aggregate statuses.
    if (index[id]?.type === 'root') {
      return;
    }
    const entry = (result[id] ??= {
      change: { value: 'status-value:unknown' } as Status,
      test: { value: 'status-value:unknown' } as Status,
    });
    if (statusPriority.indexOf(status.value) > statusPriority.indexOf(entry[slot].value)) {
      entry[slot] = status;
    }
  };

  for (const item of Object.values(index)) {
    if (item.type !== 'story' && item.type !== 'docs') {
      continue;
    }
    const ownStatuses = allStatuses[item.id];
    if (!ownStatuses) {
      continue;
    }

    for (const status of Object.values(ownStatuses)) {
      const slot =
        status.typeId === CHANGE_DETECTION_STATUS_TYPE_ID
          ? ('change' as const)
          : isAggregatedTestStatus(status)
            ? ('test' as const)
            : null;
      if (!slot) {
        continue;
      }

      // Apply the status to the story's own row.
      promote(item.id, status, slot);

      // Roll the status up to every ancestor row.
      let current: Partial<API_HashEntry> | undefined = item;
      while (current && 'parent' in current && current.parent) {
        promote(current.parent, status, slot);
        current = index[current.parent];
      }
    }
  }

  return result;
}
