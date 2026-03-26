import type { ReactElement } from 'react';

import type { FilterFunction, StatusValue, Tag } from 'storybook/internal/types';

import { BUILT_IN_FILTERS, USER_TAG_FILTER } from '../../../shared/constants/tags';

export type FilterItem = {
  id: string;
  type: string;
  title: string;
  count: number;
  icon: ReactElement | null;
  isIncluded: boolean;
  isExcluded: boolean;
  onCheckboxChange: () => void;
  onInvert: () => void;
};

/** Tags that are hidden in the filter UI. There's a more general built-in list defined in `shared/constants/tags`. */
export const BUILT_IN_TAGS = new Set([
  'dev',
  'test',
  'autodocs',
  'attached-mdx',
  'unattached-mdx',
  'play-fn',
  'test-fn',
  'manifest',
]);

export const STATUS_DISPLAY_ORDER: Array<{ shortName: string; statusValue: StatusValue }> = [
  { shortName: 'new', statusValue: 'status-value:new' },
  { shortName: 'modified', statusValue: 'status-value:modified' },
  { shortName: 'affected', statusValue: 'status-value:affected' },
  { shortName: 'error', statusValue: 'status-value:error' },
  { shortName: 'warning', statusValue: 'status-value:warning' },
  { shortName: 'success', statusValue: 'status-value:success' },
  { shortName: 'pending', statusValue: 'status-value:pending' },
  { shortName: 'unknown', statusValue: 'status-value:unknown' },
];

/**
 * Equality check for filter arrays. Works on the basis that there are no duplicates.
 * We use arrays because we need arrays for data persistence in the layout module.
 */
export const areFiltersEqual = (left: string[], right: string[]) =>
  left.length === right.length && new Set([...left, ...right]).size === left.length;

export const getFilterFunction = (tag: Tag): FilterFunction | null => {
  if (Object.hasOwn(BUILT_IN_FILTERS, tag)) {
    return BUILT_IN_FILTERS[tag as keyof typeof BUILT_IN_FILTERS];
  } else {
    return USER_TAG_FILTER(tag);
  }
};
