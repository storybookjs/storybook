import React, { Fragment, useCallback, useMemo } from 'react';

import { ActionList } from 'storybook/internal/components';
import { SIDEBAR_FILTER_CHANGED } from 'storybook/internal/core-events';
import type { StatusValue, StatusesByStoryIdAndTypeId, StoryIndex } from 'storybook/internal/types';

import { BatchAcceptIcon, DocumentIcon, ShareAltIcon, SweepIcon, UndoIcon } from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import { getStatus } from '../../utils/status.tsx';
import { createFilterLink, StatusIcon } from './FilterPanelLink.tsx';
import { type FilterItem, areFiltersEqual } from './FilterPanel.utils.ts';
import {
  type StatusFilterEntry,
  type TagFilterEntry,
  useStatusFilterEntries,
  useTagFilterEntries,
} from './useFilterData.tsx';

const Wrapper = styled.div({
  minWidth: 240,
  maxWidth: 300,
  maxHeight: 15.5 * 32 + 8, // 15.5 items at 32px each + 8px padding
  overflow: 'hidden',
  overflowY: 'auto',
  scrollbarWidth: 'thin',
});

export interface FilterPanelProps {
  api: API;
  indexJson: StoryIndex;
  defaultIncludedFilters: string[];
  defaultExcludedFilters: string[];
  includedFilters: string[];
  excludedFilters: string[];
  allStatuses: StatusesByStoryIdAndTypeId;
  includedStatusFilters: StatusValue[];
  excludedStatusFilters: StatusValue[];
}

export const FilterPanel = ({
  api,
  indexJson,
  defaultIncludedFilters,
  defaultExcludedFilters,
  includedFilters,
  excludedFilters,
  allStatuses,
  includedStatusFilters,
  excludedStatusFilters,
}: FilterPanelProps) => {
  const theme = useTheme();

  const { builtInEntries, tagEntries } = useTagFilterEntries(indexJson);
  const statusEntries = useStatusFilterEntries(allStatuses);

  const emitFilterTelemetry = useCallback(
    (changed: {
      filterType: 'tag' | 'status';
      filterId: string;
      action: 'include' | 'exclude' | 'remove';
    }) => {
      const builtInTagIds = new Set(builtInEntries.map((e) => e.id));
      const activeBuiltInIncluded = includedFilters.filter((id) => builtInTagIds.has(id));
      const activeBuiltInExcluded = excludedFilters.filter((id) => builtInTagIds.has(id));
      const activeIncludedSet = new Set(activeBuiltInIncluded);
      const activeExcludedSet = new Set(activeBuiltInExcluded);
      const includedStatusSet = new Set(includedStatusFilters);
      const excludedStatusSet = new Set(excludedStatusFilters);

      const storyCounts: Record<string, number> = {};
      for (const entry of builtInEntries) {
        if (activeIncludedSet.has(entry.id) || activeExcludedSet.has(entry.id)) {
          storyCounts[entry.id] = entry.count;
        }
      }
      for (const entry of statusEntries) {
        if (includedStatusSet.has(entry.statusValue) || excludedStatusSet.has(entry.statusValue)) {
          storyCounts[entry.statusValue] = entry.count;
        }
      }
      // Also include the count for the filter that was just changed,
      // since the state arrays may not yet reflect the toggle
      if (changed.action !== 'remove') {
        if (changed.filterType === 'tag') {
          const entry = builtInEntries.find((e) => e.id === changed.filterId);
          if (entry) storyCounts[changed.filterId] = entry.count;
        } else {
          const entry = statusEntries.find((e) => e.statusValue === changed.filterId);
          if (entry) storyCounts[changed.filterId] = entry.count;
        }
      }

      api.emit(SIDEBAR_FILTER_CHANGED, {
        trigger: 'interaction',
        changed,
        activeTagFilters: {
          included: activeBuiltInIncluded,
          excluded: activeBuiltInExcluded,
        },
        activeStatusFilters: {
          included: [...includedStatusFilters],
          excluded: [...excludedStatusFilters],
        },
        storyCounts,
      });
    },
    [
      api,
      builtInEntries,
      statusEntries,
      includedFilters,
      excludedFilters,
      includedStatusFilters,
      excludedStatusFilters,
    ]
  );

  const toTagFilterItem = useCallback(
    (entry: TagFilterEntry): FilterItem | null => {
      if (entry.count === 0 && entry.type === 'built-in') return null;
      const isIncluded = includedFilters.includes(entry.id);
      const isExcluded = excludedFilters.includes(entry.id);
      const isChecked = isIncluded || isExcluded;
      return {
        id: entry.id,
        type: entry.type,
        title: entry.title,
        count: entry.count,
        icon: entry.icon,
        isIncluded,
        isExcluded,
        onCheckboxChange: () => {
          if (isChecked) {
            api.removeTagFilters([entry.id]);
          } else {
            api.addTagFilters([entry.id], false);
          }
          if (entry.type === 'built-in') {
            emitFilterTelemetry({
              filterType: 'tag',
              filterId: entry.id,
              action: isChecked ? 'remove' : 'include',
            });
          }
        },
        onInvert: () => {
          api.addTagFilters([entry.id], !isExcluded);
          if (entry.type === 'built-in') {
            emitFilterTelemetry({
              filterType: 'tag',
              filterId: entry.id,
              action: !isExcluded ? 'exclude' : 'include',
            });
          }
        },
      };
    },
    [api, includedFilters, excludedFilters, emitFilterTelemetry]
  );

  const toStatusFilterItem = useCallback(
    (entry: StatusFilterEntry): FilterItem => {
      const isIncluded = includedStatusFilters.includes(entry.statusValue);
      const isExcluded = excludedStatusFilters.includes(entry.statusValue);
      const isChecked = isIncluded || isExcluded;
      const { icon: statusIconEl, iconColor } = getStatus(theme, entry.statusValue);
      return {
        id: entry.shortName,
        type: 'status',
        title: entry.shortName.charAt(0).toUpperCase() + entry.shortName.slice(1),
        count: entry.count,
        icon: statusIconEl ? <StatusIcon $iconColor={iconColor}>{statusIconEl}</StatusIcon> : null,
        isIncluded,
        isExcluded,
        onCheckboxChange: () => {
          if (isChecked) {
            api.removeStatusFilters([entry.statusValue]);
          } else {
            api.addStatusFilters([entry.statusValue], false);
          }
          emitFilterTelemetry({
            filterType: 'status',
            filterId: entry.statusValue,
            action: isChecked ? 'remove' : 'include',
          });
        },
        onInvert: () => {
          api.addStatusFilters([entry.statusValue], !isExcluded);
          emitFilterTelemetry({
            filterType: 'status',
            filterId: entry.statusValue,
            action: !isExcluded ? 'exclude' : 'include',
          });
        },
      };
    },
    [api, includedStatusFilters, excludedStatusFilters, theme, emitFilterTelemetry]
  );

  const builtInItems = useMemo(
    () =>
      builtInEntries
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(toTagFilterItem)
        .filter((f): f is FilterItem => f !== null),
    [builtInEntries, toTagFilterItem]
  );

  const tagItems = useMemo(
    () =>
      tagEntries
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(toTagFilterItem)
        .filter((f): f is FilterItem => f !== null),
    [tagEntries, toTagFilterItem]
  );

  const statusItems = useMemo(
    () => statusEntries.map(toStatusFilterItem),
    [statusEntries, toStatusFilterItem]
  );

  const filterIds = useMemo(
    () => [...builtInEntries.map((e) => e.id), ...tagEntries.map((e) => e.id)],
    [builtInEntries, tagEntries]
  );

  const setAllFilters = useCallback(
    (selected: boolean) => {
      api.setAllTagFilters(selected ? filterIds : [], []);
    },
    [api, filterIds]
  );

  const isDefaultSelection =
    areFiltersEqual(includedFilters, defaultIncludedFilters) &&
    areFiltersEqual(excludedFilters, defaultExcludedFilters);

  const hasDefaultSelection =
    defaultIncludedFilters.length > 0 || defaultExcludedFilters.length > 0;

  const isNothingSelectedYet =
    includedFilters.length === 0 &&
    excludedFilters.length === 0 &&
    includedStatusFilters.length === 0 &&
    excludedStatusFilters.length === 0;

  const hasItems = builtInItems.length > 0 || tagItems.length > 0;

  return (
    <Wrapper>
      {hasItems && (
        <ActionList as="div">
          <ActionList.Item as="div">
            {isNothingSelectedYet ? (
              <ActionList.Button
                ariaLabel={false}
                id="select-all"
                key="select-all"
                onClick={() => setAllFilters(true)}
              >
                <BatchAcceptIcon />
                <ActionList.Text>Select all</ActionList.Text>
              </ActionList.Button>
            ) : (
              <ActionList.Button
                ariaLabel={false}
                id="deselect-all"
                key="deselect-all"
                onClick={() => {
                  setAllFilters(false);
                  api.resetStatusFilters();
                }}
              >
                <SweepIcon />
                <ActionList.Text>Clear filters</ActionList.Text>
              </ActionList.Button>
            )}
            {hasDefaultSelection && (
              <ActionList.Button
                id="reset-filters"
                key="reset-filters"
                onClick={() => api.resetTagFilters()}
                ariaLabel="Reset filters"
                tooltip="Reset to default selection"
                disabled={isDefaultSelection}
              >
                <UndoIcon />
              </ActionList.Button>
            )}
          </ActionList.Item>
        </ActionList>
      )}
      {builtInItems.length > 0 && (
        <ActionList>
          {builtInItems.map((item) => {
            const link = createFilterLink(item);
            return <Fragment key={link.id}>{link.content}</Fragment>;
          })}
        </ActionList>
      )}
      {statusItems.length > 0 && (
        <ActionList>
          {statusItems.map((item) => {
            const link = createFilterLink(item);
            return <Fragment key={link.id}>{link.content}</Fragment>;
          })}
        </ActionList>
      )}
      {tagItems.length > 0 && (
        <ActionList>
          {tagItems.map((item) => {
            const link = createFilterLink(item);
            return <Fragment key={link.id}>{link.content}</Fragment>;
          })}
        </ActionList>
      )}
      {tagItems.length === 0 && (
        <ActionList as="div">
          <ActionList.Item as="div">
            <ActionList.Link
              ariaLabel={false}
              href={api.getDocsUrl({ subpath: 'writing-stories/tags#custom-tags' })}
              target="_blank"
            >
              <ActionList.Icon>
                <DocumentIcon />
              </ActionList.Icon>
              <ActionList.Text>
                <span>Learn how to add tags</span>
              </ActionList.Text>
              <ActionList.Icon>
                <ShareAltIcon />
              </ActionList.Icon>
            </ActionList.Link>
          </ActionList.Item>
        </ActionList>
      )}
    </Wrapper>
  );
};
