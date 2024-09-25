import type { ReactElement } from 'react';
import React from 'react';

import { styled } from '@storybook/core/theming';
import type { API_HashEntry, API_StatusState, API_StatusValue } from '@storybook/core/types';
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

export const statusPriority: API_StatusValue[] = ['unknown', 'pending', 'success', 'warn', 'error'];
export const statusMapping: Record<API_StatusValue, [ReactElement | null, string | null]> = {
  unknown: [null, null],
  pending: [<LoadingIcons key="icon" />, 'currentColor'],
  success: [
    <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
      <UseSymbol type="success" />
    </svg>,
    'currentColor',
  ],
  warn: [
    <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
      <UseSymbol type="warning" />
    </svg>,
    '#A15C20',
  ],
  error: [
    <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
      <UseSymbol type="error" />
    </svg>,
    'brown',
  ],
};

export const getHighestStatus = (statuses: API_StatusValue[]): API_StatusValue => {
  return statusPriority.reduce(
    (acc, status) => (statuses.includes(status) ? status : acc),
    'unknown'
  );
};

export function getGroupStatus(
  collapsedData: {
    [x: string]: Partial<API_HashEntry>;
  },
  // TODO does this also need to allow "| undefined" since it is treated as optional in the function body?
  //  the consumer of this function has to use @ts-expect-error because of the missing "| undefined"
  status: API_StatusState
): Record<string, API_StatusValue> {
  return Object.values(collapsedData).reduce<Record<string, API_StatusValue>>((acc, item) => {
    if (item.type === 'group' || item.type === 'component') {
      // @ts-expect-error (non strict)
      const leafs = getDescendantIds(collapsedData as any, item.id, false)
        .map((id) => collapsedData[id])
        .filter((i) => i.type === 'story');

      const combinedStatus = getHighestStatus(
        // @ts-expect-error (non strict)
        leafs.flatMap((story) => Object.values(status?.[story.id] || {})).map((s) => s.status)
      );

      if (combinedStatus) {
        // @ts-expect-error (non strict)
        acc[item.id] = combinedStatus;
      }
    }
    return acc;
  }, {});
}
