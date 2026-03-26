import React, { useMemo } from 'react';

import type {
  FilterFunction,
  StatusValue,
  StatusesByStoryIdAndTypeId,
  StoryIndex,
  Tag,
} from 'storybook/internal/types';

import { BeakerIcon, DocumentIcon, PlayHollowIcon } from '@storybook/icons';

import type { Theme } from 'storybook/theming';
import { color } from 'storybook/theming';

import { getStatus } from '../../utils/status';
import {
  BUILT_IN_TAGS,
  type FilterItem,
  STATUS_DISPLAY_ORDER,
  getFilterFunction,
} from './FilterPanel.utils';

interface UseTagFilterItemsParams {
  indexJson: StoryIndex;
  includedFilters: string[];
  excludedFilters: string[];
  toggleFilter: (id: string, selected: boolean, excluded?: boolean) => void;
}

export function useTagFilterItems({
  indexJson,
  includedFilters,
  excludedFilters,
  toggleFilter,
}: UseTagFilterItemsParams) {
  const filtersById = useMemo(() => {
    const userTagsCounts = Object.values(indexJson.entries).reduce<{ [key: Tag]: number }>(
      (acc, entry) => {
        entry.tags?.forEach((tag: Tag) => {
          if (!BUILT_IN_TAGS.has(tag)) {
            acc[tag] = (acc[tag] || 0) + 1;
          }
        });
        return acc;
      },
      {}
    );

    const userFilters = Object.fromEntries(
      Object.entries(userTagsCounts).map(([tag, count]) => {
        return [tag, { id: tag, type: 'tag', title: tag, count }];
      })
    );

    const getBuiltInCount = (filterFn: FilterFunction | null) =>
      Object.values(indexJson.entries).filter((entry) => filterFn?.(entry)).length;

    const builtInFilters = {
      _docs: {
        id: '_docs',
        type: 'built-in',
        title: 'Documentation',
        icon: React.createElement(DocumentIcon, { color: color.gold }),
        count: getBuiltInCount(getFilterFunction('_docs')),
      },
      _play: {
        id: '_play',
        type: 'built-in',
        title: 'Play',
        icon: React.createElement(PlayHollowIcon, { color: color.seafoam }),
        count: getBuiltInCount(getFilterFunction('_play')),
      },
      _test: {
        id: '_test',
        type: 'built-in',
        title: 'Testing',
        icon: React.createElement(BeakerIcon, { color: color.green }),
        count: getBuiltInCount(getFilterFunction('_test')),
      },
    };

    return { ...userFilters, ...builtInFilters };
  }, [indexJson.entries]);

  const builtInFilterIcons = useMemo(
    () => ({
      _docs: React.createElement(DocumentIcon, { color: color.gold }),
      _play: React.createElement(PlayHollowIcon, { color: color.seafoam }),
      _test: React.createElement(BeakerIcon, { color: color.green }),
    }),
    []
  );

  return useMemo(() => {
    const toFilterItem = ({
      id,
      type,
      title,
      count,
    }: {
      id: string;
      type: string;
      title: string;
      count: number;
    }): FilterItem | null => {
      if (count === 0 && type === 'built-in') return null;
      const isIncluded = includedFilters.includes(id);
      const isExcluded = excludedFilters.includes(id);
      const isChecked = isIncluded || isExcluded;
      const icon =
        type === 'built-in'
          ? (builtInFilterIcons[id as keyof typeof builtInFilterIcons] ?? null)
          : null;
      return {
        id,
        type,
        title,
        count,
        icon,
        isIncluded,
        isExcluded,
        onCheckboxChange: () => toggleFilter(id, !isChecked),
        onInvert: () => toggleFilter(id, true, !isExcluded),
      };
    };

    const allFiltersById = Object.values(filtersById);

    const builtInItems = allFiltersById
      .filter((f) => f.type === 'built-in')
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(toFilterItem)
      .filter((f): f is FilterItem => f !== null);

    const tagItems = allFiltersById
      .filter((f) => f.type === 'tag')
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(toFilterItem)
      .filter((f): f is FilterItem => f !== null);

    return { builtInItems, tagItems, filterIds: Object.keys(filtersById) };
  }, [filtersById, includedFilters, excludedFilters, toggleFilter, builtInFilterIcons]);
}

interface UseStatusFilterItemsParams {
  allStatuses: StatusesByStoryIdAndTypeId;
  includedStatusFilters: StatusValue[];
  excludedStatusFilters: StatusValue[];
  toggleStatusFilter: (statusValue: StatusValue, excluded: boolean | undefined) => void;
  theme: Theme;
}

const statusIconStyle = { display: 'contents' } as const;

export function useStatusFilterItems({
  allStatuses,
  includedStatusFilters,
  excludedStatusFilters,
  toggleStatusFilter,
  theme,
}: UseStatusFilterItemsParams) {
  const statusCounts = useMemo<Record<StatusValue, number>>(() => {
    const counts = {} as Record<StatusValue, number>;
    Object.values(allStatuses).forEach((statusByTypeId) => {
      Object.values(statusByTypeId).forEach((status) => {
        counts[status.value] = (counts[status.value] ?? 0) + 1;
      });
    });
    return counts;
  }, [allStatuses]);

  return useMemo(() => {
    return STATUS_DISPLAY_ORDER.map(({ shortName, statusValue }) => {
      const count = statusCounts[statusValue] ?? 0;
      if (count === 0) return null;
      const isIncluded = includedStatusFilters.includes(statusValue);
      const isExcluded = excludedStatusFilters.includes(statusValue);
      const isChecked = isIncluded || isExcluded;
      const { icon: statusIconEl, iconColor } = getStatus(theme, statusValue);
      const icon: React.ReactElement | null = statusIconEl
        ? React.createElement(
            'span',
            { style: iconColor ? { ...statusIconStyle, color: iconColor } : statusIconStyle },
            statusIconEl
          )
        : null;
      const item: FilterItem = {
        id: shortName,
        type: 'status',
        title: shortName,
        count,
        icon,
        isIncluded,
        isExcluded,
        onCheckboxChange: () => toggleStatusFilter(statusValue, isChecked ? undefined : false),
        onInvert: () => toggleStatusFilter(statusValue, !isExcluded),
      };
      return item;
    }).filter((f): f is FilterItem => f !== null);
  }, [statusCounts, includedStatusFilters, excludedStatusFilters, toggleStatusFilter, theme]);
}
