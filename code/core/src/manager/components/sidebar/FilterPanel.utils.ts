import type { ReactElement } from 'react';

import type { FilterFunction, StatusValue, Tag } from 'storybook/internal/types';

import { BUILT_IN_FILTERS, USER_TAG_FILTER } from '../../../shared/constants/tags.ts';

export {
  countStatusesByValue,
  statusValueShortName,
  toStatusValue,
} from '../../../shared/status-store/index.ts';

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

/** Only change-detection statuses are shown in the sidebar filter panel. */
export const STATUS_DISPLAY_ORDER: StatusValue[] = [
  'status-value:new',
  'status-value:modified',
  'status-value:affected',
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

export type FilterTelemetryChanged = {
  filterType: 'tag' | 'status';
  filterId: string;
  action: 'include' | 'exclude' | 'remove';
};

/**
 * Computes the telemetry payload for a sidebar filter interaction.
 * Projects the post-toggle active filter state so the payload reflects
 * the state *after* the change, not the stale pre-change React state.
 */
export function computeFilterTelemetryPayload(
  changed: FilterTelemetryChanged,
  {
    builtInEntries,
    statusEntries,
    includedTagFilters,
    excludedTagFilters,
    includedStatusFilters,
    excludedStatusFilters,
  }: {
    builtInEntries: Array<{ id: string; count: number }>;
    statusEntries: Array<{ statusValue: string; count: number }>;
    includedTagFilters: string[];
    excludedTagFilters: string[];
    includedStatusFilters: string[];
    excludedStatusFilters: string[];
  }
) {
  const builtInTagIds = new Set(builtInEntries.map((e) => e.id));

  // Compute the projected state after the pending toggle is applied
  let projectedIncludedTags = includedTagFilters.filter((id) => builtInTagIds.has(id));
  let projectedExcludedTags = excludedTagFilters.filter((id) => builtInTagIds.has(id));
  let projectedIncludedStatuses = [...includedStatusFilters];
  let projectedExcludedStatuses = [...excludedStatusFilters];

  if (changed.filterType === 'tag') {
    if (changed.action === 'include') {
      projectedIncludedTags = [...new Set([...projectedIncludedTags, changed.filterId])];
      projectedExcludedTags = projectedExcludedTags.filter((id) => id !== changed.filterId);
    } else if (changed.action === 'exclude') {
      projectedExcludedTags = [...new Set([...projectedExcludedTags, changed.filterId])];
      projectedIncludedTags = projectedIncludedTags.filter((id) => id !== changed.filterId);
    } else {
      projectedIncludedTags = projectedIncludedTags.filter((id) => id !== changed.filterId);
      projectedExcludedTags = projectedExcludedTags.filter((id) => id !== changed.filterId);
    }
  } else {
    if (changed.action === 'include') {
      projectedIncludedStatuses = [...new Set([...projectedIncludedStatuses, changed.filterId])];
      projectedExcludedStatuses = projectedExcludedStatuses.filter((id) => id !== changed.filterId);
    } else if (changed.action === 'exclude') {
      projectedExcludedStatuses = [...new Set([...projectedExcludedStatuses, changed.filterId])];
      projectedIncludedStatuses = projectedIncludedStatuses.filter((id) => id !== changed.filterId);
    } else {
      projectedIncludedStatuses = projectedIncludedStatuses.filter((id) => id !== changed.filterId);
      projectedExcludedStatuses = projectedExcludedStatuses.filter((id) => id !== changed.filterId);
    }
  }

  const projectedIncludedTagSet = new Set(projectedIncludedTags);
  const projectedExcludedTagSet = new Set(projectedExcludedTags);
  const projectedIncludedStatusSet = new Set(projectedIncludedStatuses);
  const projectedExcludedStatusSet = new Set(projectedExcludedStatuses);

  const storyCounts: Record<string, number> = {};
  for (const entry of builtInEntries) {
    if (projectedIncludedTagSet.has(entry.id) || projectedExcludedTagSet.has(entry.id)) {
      storyCounts[entry.id] = entry.count;
    }
  }
  for (const entry of statusEntries) {
    if (
      projectedIncludedStatusSet.has(entry.statusValue) ||
      projectedExcludedStatusSet.has(entry.statusValue)
    ) {
      storyCounts[entry.statusValue] = entry.count;
    }
  }

  return {
    trigger: 'interaction' as const,
    changed,
    activeTagFilters: {
      included: projectedIncludedTags,
      excluded: projectedExcludedTags,
    },
    activeStatusFilters: {
      included: projectedIncludedStatuses,
      excluded: projectedExcludedStatuses,
    },
    storyCounts,
  };
}
