import type { ReactElement } from 'react';

import type {
  API_PreparedIndexEntry,
  FilterFunction,
  StatusValue,
  StatusesByStoryIdAndTypeId,
  StoryIndex,
  Tag,
} from 'storybook/internal/types';

import { BUILT_IN_FILTERS, USER_TAG_FILTER } from '../../../shared/constants/tags.ts';

export { statusValueShortName, toStatusValue } from '../../../shared/status-store/index.ts';

export type FilterItem = {
  id: string;
  type: string;
  title: string;
  count: number;
  visibleCount: number;
  toggle: FilterProjection;
  invert: FilterProjection;
  icon: ReactElement | null;
  isIncluded: boolean;
  isExcluded: boolean;
  onCheckboxChange: () => void;
  onInvert: () => void;
};

export type FilterPreviewAction = 'toggle' | 'invert';

export type FilterProjection = {
  visibleCount: number;
  delta: number;
};

type FilterState = {
  includedFilters: string[];
  excludedFilters: string[];
  includedStatusFilters: StatusValue[];
  excludedStatusFilters: StatusValue[];
};

type FilterableEntry = Pick<API_PreparedIndexEntry, 'id' | 'subtype' | 'tags' | 'type'>;

export type FilterPanelCounts = {
  currentVisibleCount: number;
  totalCount: number;
  tags: Record<
    string,
    { visibleCount: number; toggle: FilterProjection; invert: FilterProjection }
  >;
  statuses: Partial<
    Record<
      StatusValue,
      { visibleCount: number; toggle: FilterProjection; invert: FilterProjection }
    >
  >;
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

export const formatFilterDelta = (delta: number) => {
  if (delta > 0) {
    return `+${delta}`;
  }

  return `${delta}`;
};

export const getFilterFunction = (tag: Tag): FilterFunction | null => {
  if (Object.hasOwn(BUILT_IN_FILTERS, tag)) {
    return BUILT_IN_FILTERS[tag as keyof typeof BUILT_IN_FILTERS];
  } else {
    return USER_TAG_FILTER(tag);
  }
};

const getFilterLabelType = (type: string) => (type === 'status' ? 'status' : 'tag');

const getFilterActionVerb = (
  { isIncluded, isExcluded }: Pick<FilterItem, 'isIncluded' | 'isExcluded'>,
  action: FilterPreviewAction
) => {
  if (action === 'toggle') {
    return isIncluded || isExcluded ? 'remove' : 'include';
  }

  return isExcluded ? 'include' : 'exclude';
};

export const getFilterPreviewDescription = (
  item: Pick<FilterItem, 'isIncluded' | 'isExcluded' | 'title' | 'type'>,
  action: FilterPreviewAction
) => `${getFilterActionVerb(item, action)} ${getFilterLabelType(item.type)} filter ${item.title}`;

const getLeafEntries = (indexJson: StoryIndex): FilterableEntry[] =>
  Object.entries(indexJson.entries).flatMap(([id, entry]) =>
    entry.type === 'story' || entry.type === 'docs' ? [{ id, ...entry }] : []
  );

const matchTag = (entry: FilterableEntry, tag: string) =>
  getFilterFunction(tag as Tag)?.(entry as API_PreparedIndexEntry) ?? false;

const matchStatus = (
  entry: FilterableEntry,
  allStatuses: StatusesByStoryIdAndTypeId,
  statusValue: StatusValue
) => Object.values(allStatuses[entry.id] ?? {}).some((status) => status.value === statusValue);

const compileTagFilters = (filters: string[]): FilterFunction[][] =>
  Object.values(
    filters.reduce(
      (acc, tag) => {
        const filterFn = getFilterFunction(tag as Tag);
        if (!filterFn) {
          return acc;
        }

        if (Object.hasOwn(BUILT_IN_FILTERS, tag)) {
          acc['built-in'].push(filterFn);
        } else {
          acc.user.push(filterFn);
        }

        return acc;
      },
      { 'built-in': [], user: [] } as { 'built-in': FilterFunction[]; user: FilterFunction[] }
    )
  ).filter((group) => group.length > 0);

const matchesFilters = (
  entry: FilterableEntry,
  compiledTags: { included: FilterFunction[][]; excluded: FilterFunction[][] },
  allStatuses: StatusesByStoryIdAndTypeId,
  { includedStatusFilters, excludedStatusFilters }: FilterState
) => {
  const matchesIncludedTags =
    compiledTags.included.length === 0 ||
    compiledTags.included.every((group) =>
      group.some((filterFn) => filterFn(entry as API_PreparedIndexEntry, false))
    );

  const matchesExcludedTags =
    compiledTags.excluded.length === 0 ||
    compiledTags.excluded.every((group) =>
      group.every((filterFn) => filterFn(entry as API_PreparedIndexEntry, true))
    );

  const statuses = Object.values(allStatuses[entry.id] ?? {}).map((status) => status.value);
  const matchesIncludedStatuses =
    includedStatusFilters.length === 0 ||
    includedStatusFilters.some((value) => statuses.includes(value));
  const matchesExcludedStatuses =
    excludedStatusFilters.length === 0 ||
    excludedStatusFilters.every((value) => !statuses.includes(value));

  return (
    matchesIncludedTags && matchesExcludedTags && matchesIncludedStatuses && matchesExcludedStatuses
  );
};

const serializeFilterState = ({
  excludedFilters,
  excludedStatusFilters,
  includedFilters,
  includedStatusFilters,
}: FilterState) =>
  [
    [...includedFilters].sort().join(';'),
    [...excludedFilters].sort().join(';'),
    [...includedStatusFilters].sort().join(';'),
    [...excludedStatusFilters].sort().join(';'),
  ].join('|');

const updateFilterState = (
  currentState: FilterState,
  kind: 'tag' | 'status',
  value: string,
  action: FilterPreviewAction
): FilterState => {
  const included =
    kind === 'tag'
      ? new Set(currentState.includedFilters)
      : new Set(currentState.includedStatusFilters);
  const excluded =
    kind === 'tag'
      ? new Set(currentState.excludedFilters)
      : new Set(currentState.excludedStatusFilters);

  const isIncluded = included.has(value);
  const isExcluded = excluded.has(value);

  if (action === 'toggle') {
    if (isIncluded || isExcluded) {
      included.delete(value);
      excluded.delete(value);
    } else {
      included.add(value);
      excluded.delete(value);
    }
  } else if (isExcluded) {
    included.add(value);
    excluded.delete(value);
  } else {
    included.delete(value);
    excluded.add(value);
  }

  return {
    includedFilters: kind === 'tag' ? Array.from(included) : [...currentState.includedFilters],
    excludedFilters: kind === 'tag' ? Array.from(excluded) : [...currentState.excludedFilters],
    includedStatusFilters:
      kind === 'status'
        ? (Array.from(included) as StatusValue[])
        : [...currentState.includedStatusFilters],
    excludedStatusFilters:
      kind === 'status'
        ? (Array.from(excluded) as StatusValue[])
        : [...currentState.excludedStatusFilters],
  };
};

export const computeFilterPanelCounts = ({
  allStatuses,
  includedFilters,
  excludedFilters,
  includedStatusFilters,
  excludedStatusFilters,
  indexJson,
  statusValues,
  tagIds,
}: {
  allStatuses: StatusesByStoryIdAndTypeId;
  includedFilters: string[];
  excludedFilters: string[];
  includedStatusFilters: StatusValue[];
  excludedStatusFilters: StatusValue[];
  indexJson: StoryIndex;
  statusValues: StatusValue[];
  tagIds: string[];
}): FilterPanelCounts => {
  const leafEntries = getLeafEntries(indexJson);
  const currentState: FilterState = {
    includedFilters,
    excludedFilters,
    includedStatusFilters,
    excludedStatusFilters,
  };

  const visibleCountCache = new Map<string, number>();

  const getVisibleCount = (state: FilterState) => {
    const cacheKey = serializeFilterState(state);
    const cached = visibleCountCache.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const compiledTags = {
      included: compileTagFilters(state.includedFilters),
      excluded: compileTagFilters(state.excludedFilters),
    };

    const count = leafEntries.filter((entry) =>
      matchesFilters(entry, compiledTags, allStatuses, state)
    ).length;

    visibleCountCache.set(cacheKey, count);

    return count;
  };

  const currentCompiledTags = {
    included: compileTagFilters(includedFilters),
    excluded: compileTagFilters(excludedFilters),
  };
  const currentVisibleEntries = leafEntries.filter((entry) =>
    matchesFilters(entry, currentCompiledTags, allStatuses, currentState)
  );
  const currentVisibleCount = currentVisibleEntries.length;

  const buildCounts = (
    kind: 'tag' | 'status',
    value: string,
    predicate: (entry: FilterableEntry) => boolean,
    isIncluded: boolean
  ) => {
    const toggleState = updateFilterState(currentState, kind, value, 'toggle');
    const invertState = updateFilterState(currentState, kind, value, 'invert');

    return {
      visibleCount: isIncluded ? currentVisibleEntries.filter(predicate).length : 0,
      toggle: {
        visibleCount: getVisibleCount(toggleState),
        delta: getVisibleCount(toggleState) - currentVisibleCount,
      },
      invert: {
        visibleCount: getVisibleCount(invertState),
        delta: getVisibleCount(invertState) - currentVisibleCount,
      },
    };
  };

  return {
    currentVisibleCount,
    totalCount: leafEntries.length,
    tags: Object.fromEntries(
      tagIds.map((tagId) => [
        tagId,
        buildCounts(
          'tag',
          tagId,
          (entry) => matchTag(entry, tagId),
          includedFilters.includes(tagId)
        ),
      ])
    ),
    statuses: Object.fromEntries(
      statusValues.map((statusValue) => [
        statusValue,
        buildCounts(
          'status',
          statusValue,
          (entry) => matchStatus(entry, allStatuses, statusValue),
          includedStatusFilters.includes(statusValue)
        ),
      ])
    ),
  };
};
