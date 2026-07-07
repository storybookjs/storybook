import type { ReactElement } from 'react';
import React from 'react';

import type { API_IndexHash, API_StoryEntry, Status, StatusValue } from 'storybook/internal/types';
import {
  CHANGE_DETECTION_STATUS_TYPE_ID,
  NON_AGGREGATED_STATUS_TYPE_IDS,
  REVIEW_STATUS_TYPE_ID,
  type API_HashEntry,
  type StatusByTypeId,
  type StatusesByStoryIdAndTypeId,
  type StoryId,
} from 'storybook/internal/types';

import {
  CircleIcon,
  StatusFailIcon,
  StatusPassIcon,
  StatusWarnIcon,
  SyncIcon,
} from '@storybook/icons';

import memoizerific from 'memoizerific';
import { transparentize } from 'polished';
import { type Theme, styled } from 'storybook/theming';

import { UseSymbol } from '../components/sidebar/IconSymbols.tsx';
import { getDescendantIds } from './tree.ts';

const SmallIcons = styled(CircleIcon)({
  // specificity hack
  '&&&': {
    width: 6,
    height: 6,
  },
});

const LoadingIcons = styled(SmallIcons)(({ theme: { animation } }) => ({
  // specificity hack
  animation: `${animation.glow} 1.5s ease-in-out infinite`,
}));

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

/** Matches the status icon shown on a sidebar row before hover. */
export function getSidebarVisibleStatus({
  theme,
  item,
  statuses,
  groupDualStatus,
  isModifiedFilterActive,
}: {
  theme: Theme;
  item: {
    type: API_HashEntry['type'];
    id: StoryId;
    subtype?: string;
    children?: string[];
  };
  statuses?: StatusByTypeId;
  groupDualStatus?: Record<StoryId, { change: StatusValue; test: StatusValue }>;
  isModifiedFilterActive: boolean;
}): { icon: ReactElement | null; status: StatusValue } {
  const statusByType = statuses ?? {};

  const isBranch =
    item.type === 'group' ||
    item.type === 'component' ||
    (item.type === 'story' && item.children && item.children.length > 0);

  if (isBranch) {
    const { changeStatus: localChange, testStatus: localTest } =
      getChangeDetectionStatus(statusByType);
    const groupDual = groupDualStatus?.[item.id] ?? {
      change: 'status-value:unknown' as StatusValue,
      test: 'status-value:unknown' as StatusValue,
    };
    const branchChange = getMostCriticalStatusValue([localChange, groupDual.change]);
    const branchTest = getMostCriticalStatusValue([localTest, groupDual.test]);

    if (shouldShowChangeStatus(branchChange, isModifiedFilterActive)) {
      return { icon: getStatus(theme, branchChange).icon, status: branchChange };
    }
    return { icon: getStatus(theme, branchTest).icon, status: branchTest };
  }

  const isStoryOrDocsLeaf =
    (item.type === 'story' &&
      !(item.children && item.children.length > 0) &&
      item.subtype !== 'test') ||
    item.type === 'docs';

  if (isStoryOrDocsLeaf) {
    const { changeStatus, testStatus } = getChangeDetectionStatus(statusByType);
    if (shouldShowChangeStatus(changeStatus, isModifiedFilterActive)) {
      return { icon: getStatus(theme, changeStatus).icon, status: changeStatus };
    }
    return { icon: getStatus(theme, testStatus).icon, status: testStatus };
  }

  // Test/other leaf: roll up the test statuses, but keep a "new" change-detection status visible.
  const leafStatuses = Object.values(statusByType).filter(
    (status) => isAggregatedTestStatus(status) || status.value === 'status-value:new'
  );
  const leafStatus = getMostCriticalStatusValue(leafStatuses.map((s) => s.value));
  return { icon: getStatus(theme, leafStatus).icon, status: leafStatus };
}

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

export function getGroupDualStatus(
  collapsedData: API_IndexHash,
  allStatuses: StatusesByStoryIdAndTypeId
): Record<string, { change: Status; test: Status }> {
  return Object.values(collapsedData).reduce<Record<string, { change: Status; test: Status }>>(
    (acc, item) => {
      if (item.type === 'group' || item.type === 'component' || item.type === 'story') {
        const allDescendantStatuses = getDescendantIds(collapsedData, item.id, false)
          .map((childId) => collapsedData[childId])
          .filter((child): child is API_StoryEntry => child.type === 'story')
          .map((child) => allStatuses[child.id])
          .filter((status) => !!status)
          .flatMap((status) => Object.values(status));

        const changeStatuses = allDescendantStatuses.filter(
          (s) => s.typeId === CHANGE_DETECTION_STATUS_TYPE_ID
        );
        const testStatuses = allDescendantStatuses.filter(isAggregatedTestStatus);

        const mostCriticalChange = getMostCriticalStatusValue(changeStatuses.map((s) => s.value));
        const mostCriticalTest = getMostCriticalStatusValue(testStatuses.map((s) => s.value));

        acc[item.id] = {
          change:
            changeStatuses.find((s) => s.value === mostCriticalChange) ??
            ({ value: mostCriticalChange } as Status),
          test:
            testStatuses.find((s) => s.value === mostCriticalTest) ??
            ({ value: mostCriticalTest } as Status),
        };
      }
      return acc;
    },
    {}
  );
}
