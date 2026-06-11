import type { ReactElement } from 'react';
import React from 'react';

import type { StatusValue } from 'storybook/internal/types';
import {
  CHANGE_DETECTION_STATUS_TYPE_ID,
  type API_HashEntry,
  type StatusByTypeId,
  type StatusesByStoryIdAndTypeId,
  type StoryId,
} from 'storybook/internal/types';

import { CircleIcon, StatusNewIcon } from '@storybook/icons';

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
  iconColor: string | null;
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
      iconColor: defaultIconColor,
      textColor: null,
    },
    'status-value:pending': {
      icon: <LoadingIcons key="icon" />,
      iconColor: defaultIconColor,
      textColor: 'currentColor',
    },
    'status-value:success': {
      icon: (
        <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
          <UseSymbol type="success" />
        </svg>
      ),
      iconColor: theme.color.positive,
      textColor: 'currentColor',
    },
    'status-value:new': {
      icon: (
        <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
          <UseSymbol type="new" />
        </svg>
      ),
      iconColor: theme.fgColor.accent,
      textColor: null,
    },
    'status-value:modified': {
      icon: (
        <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
          <UseSymbol type="modified" />
        </svg>
      ),
      iconColor: theme.fgColor.accent,
      textColor: null,
    },
    'status-value:affected': {
      icon: (
        <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
          <UseSymbol type="affected" />
        </svg>
      ),
      iconColor: theme.fgColor.accent,
      textColor: null,
    },
    'status-value:reviewing': {
      icon: <StatusNewIcon key="icon" />,
      iconColor: theme.fgColor.accent,
      textColor: null,
    },
    'status-value:warning': {
      icon: (
        <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
          <UseSymbol type="warning" />
        </svg>
      ),
      iconColor: theme.color.warning,
      textColor: theme.fgColor.warning,
    },
    'status-value:error': {
      icon: (
        <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
          <UseSymbol type="error" />
        </svg>
      ),
      iconColor: theme.color.negative,
      textColor: theme.fgColor.negative,
    },
  };
  return statusMapping[status];
});

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

    const shouldShowBranchChangeIcon =
      branchChange !== 'status-value:unknown' &&
      branchChange !== 'status-value:affected' &&
      (branchChange !== 'status-value:modified' || isModifiedFilterActive);
    if (shouldShowBranchChangeIcon) {
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
    const showChange =
      changeStatus !== 'status-value:unknown' &&
      changeStatus !== 'status-value:affected' &&
      (changeStatus !== 'status-value:modified' || isModifiedFilterActive);
    if (showChange) {
      return { icon: getStatus(theme, changeStatus).icon, status: changeStatus };
    }
    return { icon: getStatus(theme, testStatus).icon, status: testStatus };
  }

  const leafStatuses = Object.fromEntries(
    Object.entries(statusByType).filter(
      ([, status]) =>
        status.typeId !== CHANGE_DETECTION_STATUS_TYPE_ID || status.value === 'status-value:new'
    )
  );
  const leafStatus = getMostCriticalStatusValue(Object.values(leafStatuses).map((s) => s.value));
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
    .filter((status) => status.typeId !== CHANGE_DETECTION_STATUS_TYPE_ID)
    .map((status) => status.value);
  return {
    changeStatus: getMostCriticalStatusValue(changeValues),
    testStatus: getMostCriticalStatusValue(testValues),
  };
}

export const getMostCriticalStatusValue = (statusValues: StatusValue[]): StatusValue => {
  return statusPriority.reduce(
    (acc, value) => (statusValues.includes(value) ? value : acc),
    'status-value:unknown'
  );
};

export function getGroupStatus(
  collapsedData: {
    [x: string]: Partial<API_HashEntry>;
  },
  allStatuses: StatusesByStoryIdAndTypeId
): Record<string, StatusValue> {
  return Object.values(collapsedData).reduce<Record<string, StatusValue>>((acc, item) => {
    if (item.type === 'group' || item.type === 'component' || item.type === 'story') {
      // @ts-expect-error (non strict)
      const leafs = getDescendantIds(collapsedData as any, item.id, false)
        .map((id) => collapsedData[id])
        .filter((i) => i.type === 'story');

      const combinedStatus = getMostCriticalStatusValue(
        // @ts-expect-error (non strict)
        leafs.flatMap((story) => Object.values(allStatuses[story.id] || {})).map((s) => s.value)
      );

      if (combinedStatus) {
        // @ts-expect-error (non strict)
        acc[item.id] = combinedStatus;
      }
    }
    return acc;
  }, {});
}

export function getGroupDualStatus(
  collapsedData: {
    [x: string]: Partial<API_HashEntry>;
  },
  allStatuses: StatusesByStoryIdAndTypeId
): Record<string, { change: StatusValue; test: StatusValue }> {
  return Object.values(collapsedData).reduce<
    Record<string, { change: StatusValue; test: StatusValue }>
  >((acc, item) => {
    if (item.type === 'group' || item.type === 'component' || item.type === 'story') {
      // @ts-expect-error (non strict)
      const leafs = getDescendantIds(collapsedData as any, item.id, false)
        .map((id) => collapsedData[id])
        .filter((i) => i.type === 'story');

      const allDescendantStatuses = leafs.flatMap(
        (story) =>
          Object.values(allStatuses[story.id!] || {}) as Array<{
            typeId: string;
            value: StatusValue;
          }>
      );

      const changeValues = allDescendantStatuses
        .filter((s: { typeId: string }) => s.typeId === CHANGE_DETECTION_STATUS_TYPE_ID)
        .map((s: { value: StatusValue }) => s.value);
      const testValues = allDescendantStatuses
        .filter((s: { typeId: string }) => s.typeId !== CHANGE_DETECTION_STATUS_TYPE_ID)
        .map((s: { value: StatusValue }) => s.value);

      // @ts-expect-error (non strict)
      acc[item.id] = {
        change: getMostCriticalStatusValue(changeValues),
        test: getMostCriticalStatusValue(testValues),
      };
    }
    return acc;
  }, {});
}
