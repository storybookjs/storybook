import React, { useMemo } from 'react';

import type {
  FilterFunction,
  StatusValue,
  StatusesByStoryIdAndTypeId,
  StoryIndex,
  Tag,
} from 'storybook/internal/types';

import { BeakerIcon, DocumentIcon, PlayHollowIcon } from '@storybook/icons';

import { color } from 'storybook/theming';

import {
  BUILT_IN_TAGS,
  STATUS_DISPLAY_ORDER,
  getFilterFunction,
  statusValueShortName,
} from './FilterPanel.utils.ts';

export interface TagFilterEntry {
  id: string;
  type: 'built-in' | 'tag';
  title: string;
  count: number;
  icon: React.ReactElement | null;
}

export interface StatusFilterEntry {
  statusValue: StatusValue;
  shortName: string;
  count: number;
}

const BUILT_IN_FILTER_DEFS: Array<{
  id: string;
  title: string;
  icon: React.ReactElement;
  tag: string;
}> = [
  { id: '_docs', title: 'Documentation', icon: <DocumentIcon color={color.gold} />, tag: '_docs' },
  { id: '_play', title: 'Play', icon: <PlayHollowIcon color={color.seafoam} />, tag: '_play' },
  { id: '_test', title: 'Testing', icon: <BeakerIcon color={color.green} />, tag: '_test' },
];

export function useTagFilterEntries(indexJson: StoryIndex) {
  return useMemo(() => {
    const entries = Object.values(indexJson.entries);

    const userTagsCounts = entries.reduce<Record<Tag, number>>((acc, entry) => {
      entry.tags?.forEach((tag: Tag) => {
        if (!BUILT_IN_TAGS.has(tag)) {
          acc[tag] = (acc[tag] || 0) + 1;
        }
      });
      return acc;
    }, {});

    const tagEntries: TagFilterEntry[] = Object.entries(userTagsCounts).map(([tag, count]) => ({
      id: tag,
      type: 'tag',
      title: tag,
      count,
      icon: null,
    }));

    const getBuiltInCount = (filterFn: FilterFunction | null) =>
      entries.filter((entry) => filterFn?.(entry)).length;

    const builtInEntries: TagFilterEntry[] = BUILT_IN_FILTER_DEFS.map((def) => ({
      id: def.id,
      type: 'built-in',
      title: def.title,
      icon: def.icon,
      count: getBuiltInCount(getFilterFunction(def.tag)),
    }));

    return { builtInEntries, tagEntries };
  }, [indexJson.entries]);
}

export function useStatusFilterEntries(allStatuses: StatusesByStoryIdAndTypeId) {
  return useMemo(() => {
    const counts = {} as Record<StatusValue, number>;
    Object.values(allStatuses).forEach((statusByTypeId) => {
      Object.values(statusByTypeId).forEach((status) => {
        counts[status.value] = (counts[status.value] ?? 0) + 1;
      });
    });

    return STATUS_DISPLAY_ORDER.filter((statusValue) => (counts[statusValue] ?? 0) > 0).map(
      (statusValue) => ({
        statusValue,
        shortName: statusValueShortName(statusValue),
        count: counts[statusValue],
      })
    );
  }, [allStatuses]);
}
