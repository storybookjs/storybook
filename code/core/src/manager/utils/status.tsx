import type { ReactElement } from 'react';
import React from 'react';

import {
  type API_HashEntry,
  type StatusValue,
  type StatusesByStoryIdAndTypeId,
} from 'storybook/internal/types';

import { CircleIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import { UseSymbol } from '../components/sidebar/IconSymbols';
import { getDescendantIds } from './tree';

const SmallIcons = styled(CircleIcon)({
  // specificity hack
  '&&&': {
    width: 6,
    height: 6,
  },
});

const LoadingIcons = styled(SmallIcons)(({ theme: { animation, color, base } }) => ({
  // specificity hack
  animation: `${animation.glow} 1.5s ease-in-out infinite`,
  color: base === 'light' ? color.mediumdark : color.darker,
}));

export const statusPriority: StatusValue[] = [
  'status-value:unknown',
  'status-value:pending',
  'status-value:success',
  'status-value:warning',
  'status-value:error',
];
export const statusMapping: Record<StatusValue, [ReactElement | null, string | null]> = {
  ['status-value:unknown']: [null, null],
  ['status-value:pending']: [<LoadingIcons key="icon" />, 'currentColor'],
  ['status-value:success']: [
    <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
      <UseSymbol type="success" />
    </svg>,
    'currentColor',
  ],
  ['status-value:warning']: [
    <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
      <UseSymbol type="warning" />
    </svg>,
    '#A15C20',
  ],
  ['status-value:error']: [
    <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
      <UseSymbol type="error" />
    </svg>,
    '#D43900',
  ],
};

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
