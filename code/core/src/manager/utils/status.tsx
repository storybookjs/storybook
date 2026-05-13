import type { ReactElement } from 'react';
import React from 'react';

import type { StatusValue } from 'storybook/internal/types';
import { type API_HashEntry, type StatusesByStoryIdAndTypeId } from 'storybook/internal/types';

import { CircleIcon } from '@storybook/icons';

import memoizerific from 'memoizerific';
import { transparentize } from 'polished';
import { type Theme, styled } from 'storybook/theming';

import { UseSymbol } from '../components/sidebar/IconSymbols.tsx';

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

export const getMostCriticalStatusValue = (statusValues: StatusValue[]): StatusValue => {
  return statusPriority.findLast((value) => statusValues.includes(value)) || 'status-value:unknown';
};

// FIXME/TODO: remove if unused
export const sortByMostCriticalStatus = (a: StatusValue, b: StatusValue): number => {
  for (const value of statusPriority) {
    if (a === value || b === value) {
      // NOTE: the array goes from least to most important but we virtually want
      // to sort by most important first. So we must reverse traditional sort order.
      return a === value ? -1 : 1;
    }
  }
  return 0;
};

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

    const leafStatus = getMostCriticalStatusValue(Object.values(storyStatuses).map((s) => s.value));

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
