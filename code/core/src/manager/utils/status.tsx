import type { ReactElement } from 'react';
import React from 'react';

import { styled } from 'storybook/internal/theming';
import {
  type API_HashEntry,
  StatusValue,
  type StatusValueType,
  type StatusesByStoryIdAndTypeId,
} from 'storybook/internal/types';

import { CircleIcon } from '@storybook/icons';

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

export const statusPriority: StatusValueType[] = [
  StatusValue.UNKNOWN,
  StatusValue.PENDING,
  StatusValue.SUCCESS,
  StatusValue.WARN,
  StatusValue.ERROR,
];
export const statusMapping: Record<StatusValueType, [ReactElement | null, string | null]> = {
  [StatusValue.UNKNOWN]: [null, null],
  [StatusValue.PENDING]: [<LoadingIcons key="icon" />, 'currentColor'],
  [StatusValue.SUCCESS]: [
    <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
      <UseSymbol type="success" />
    </svg>,
    'currentColor',
  ],
  [StatusValue.WARN]: [
    <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
      <UseSymbol type="warning" />
    </svg>,
    '#A15C20',
  ],
  [StatusValue.ERROR]: [
    <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
      <UseSymbol type="error" />
    </svg>,
    'brown',
  ],
};

export const getHighestStatus = (statusValues: StatusValueType[]): StatusValueType => {
  return statusPriority.reduce(
    (acc, value) => (statusValues.includes(value) ? value : acc),
    StatusValue.UNKNOWN
  );
};

export function getGroupStatus(
  collapsedData: {
    [x: string]: Partial<API_HashEntry>;
  },
  allStatuses?: StatusesByStoryIdAndTypeId
): Record<string, StatusValueType> {
  return Object.values(collapsedData).reduce<Record<string, StatusValueType>>((acc, item) => {
    if (item.type === 'group' || item.type === 'component') {
      // @ts-expect-error (non strict)
      const leafs = getDescendantIds(collapsedData as any, item.id, false)
        .map((id) => collapsedData[id])
        .filter((i) => i.type === 'story');

      const combinedStatus = getHighestStatus(
        // @ts-expect-error (non strict)
        leafs.flatMap((story) => Object.values(allStatuses?.[story.id] || {})).map((s) => s.value)
      );

      if (combinedStatus) {
        // @ts-expect-error (non strict)
        acc[item.id] = combinedStatus;
      }
    }
    return acc;
  }, {});
}
