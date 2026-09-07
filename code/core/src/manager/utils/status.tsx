import type { ReactElement } from 'react';
import React from 'react';

import type { API_IndexHash, Status, StatusValue } from 'storybook/internal/types';
import {
  CHANGE_DETECTION_STATUS_TYPE_ID,
  NON_AGGREGATED_STATUS_TYPE_IDS,
  REVIEW_STATUS_TYPE_ID,
  type API_HashEntry,
  type StatusByTypeId,
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

  // FIXME/TODO: check if size 12 or 14.

  const statusMapping: Record<StatusValue, StatusMapping> = {
    'status-value:unknown': {
      icon: null,
      textColor: null,
    },
    'status-value:pending': {
      icon: <SyncIcon size={12} color={defaultIconColor} />,
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

export function getChangeDetectionStatus(statuses: StatusByTypeId): {
  changeStatus: StatusValue;
  testStatus: StatusValue;
} {
  const changeValues = Object.values(statuses)
    .filter((status) => status.typeId === CHANGE_DETECTION_STATUS_TYPE_ID)
    .map((status) => status.value);
  const testValues = Object.values(statuses)
    .filter(isAggregatedTestStatus)
    .map((status) => status.value);
  return {
    changeStatus: getMostCriticalStatusValue(changeValues),
    testStatus: getMostCriticalStatusValue(testValues),
  };
}

export const getMostCriticalStatusValue = (statusValues: StatusValue[]): StatusValue => {
  return statusPriority.findLast((value) => statusValues.includes(value)) || 'status-value:unknown';
};

// Drop the review (reviewing) status type. Unlike the aggregated test status, the single group
// aggregate (getGroupStatus) intentionally keeps change-detection so a group still surfaces a
// modified/new indicator; only review is meaningless at that level.
const statusesExcludingReview = <T extends { typeId: string }>(statuses: T[]): T[] =>
  statuses.filter((status) => status.typeId !== REVIEW_STATUS_TYPE_ID);

/**
 * Compute the aggregate status for every non-leaf item in a single bottom-up pass.
 *
 * For each story leaf we look up its most-critical status, then walk up the parent chain
 * and promote each ancestor's status if the leaf's status is more critical. This replaces
 * the previous O(n*m) approach that called the memoizerific-wrapped `getDescendantIds` per
 * item — which thrashed the LRU cache because `collapsedData` is a fresh object on every
 * render.
 */
export function getGroupStatus(
  collapsedData: {
    [x: string]: Partial<API_HashEntry>;
  },
  allStatuses: StatusesByStoryIdAndTypeId
): Record<string, StatusValue> {
  const result: Record<string, StatusValue> = {};

  for (const item of Object.values(collapsedData)) {
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

    // Walk up the parent chain and propagate the most-critical status.
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

      currentItem = collapsedData[pid];
    }
  }

  return result;
}

/**
 * Compute the dual (change-detection + test) status for every item in a single bottom-up pass:
 * each story/docs entry's own statuses apply to its own row and roll up its ancestor chain.
 * Like getGroupStatus, this avoids the O(n*m) per-item getDescendantIds materialization.
 *
 * Review-typed statuses are excluded from both slots (they are neither test results nor change
 * detection), matching isAggregatedTestStatus.
 */
export function getGroupDualStatus(
  collapsedData: API_IndexHash,
  allStatuses: StatusesByStoryIdAndTypeId
): Record<string, { change: Status; test: Status }> {
  const result: Record<string, { change: Status; test: Status }> = {};

  const promote = (id: string, status: Status, slot: 'change' | 'test') => {
    // Root rows never display aggregate statuses.
    if (collapsedData[id]?.type === 'root') {
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

  for (const item of Object.values(collapsedData)) {
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

      // The status colors the story's own row…
      promote(item.id, status, slot);

      // …and rolls up the ancestor chain.
      let current: Partial<API_HashEntry> | undefined = item;
      while (current && 'parent' in current && current.parent) {
        promote(current.parent, status, slot);
        current = collapsedData[current.parent];
      }
    }
  }

  return result;
}
