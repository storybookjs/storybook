import React from 'react';
import type { ReactElement } from 'react';
import type { API_HashEntry, API_StatusState, API_StatusValue } from '@storybook/core/types';

import { styled } from '@storybook/core/theming';

import { getDescendantIds } from './tree';
import { CircleIcon } from '@storybook/icons';

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
  success: [<SmallIcons key="icon" style={{ color: 'green' }} />, 'currentColor'],
  warn: [<SmallIcons key="icon" style={{ color: 'orange' }} />, '#A15C20'],
  error: [<SmallIcons key="icon" style={{ color: 'red' }} />, 'brown'],
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
