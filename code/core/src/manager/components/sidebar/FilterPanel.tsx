import React, { Fragment, useCallback, useMemo, useState } from 'react';

import { ActionList } from 'storybook/internal/components';
import type { StatusValue, StatusesByStoryIdAndTypeId, StoryIndex } from 'storybook/internal/types';

import { BatchAcceptIcon, DocumentIcon, ShareAltIcon, SweepIcon, UndoIcon } from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import { getStatus } from '../../utils/status.tsx';
import { createFilterLink, StatusIcon } from './FilterPanelLink.tsx';
import {
  type FilterItem,
  type FilterPreviewAction,
  areFiltersEqual,
  computeFilterPanelCounts,
  getFilterPreviewDescription,
} from './FilterPanel.utils.ts';
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

const SummaryRow = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px 4px',
  color: theme.textMutedColor,
  fontSize: theme.typography.size.s1,
}));

const getSummaryCountColor = (
  delta: number,
  isPreview: boolean,
  theme: { color: { negative: string; positive: string; secondary: string } }
) => {
  if (!isPreview) {
    return 'inherit';
  }

  if (delta > 0) {
    return theme.color.positive;
  }

  if (delta < 0) {
    return theme.color.negative;
  }

  return theme.color.secondary;
};

const SummaryCount = styled.span<{ $delta: number; $isPreview: boolean }>(
  ({ theme, $delta, $isPreview }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '2px 8px',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: theme.typography.weight.bold,
    background: $isPreview ? theme.background.hoverable : 'transparent',
    color: getSummaryCountColor($delta, $isPreview, theme),
  })
);

const getItemPreviewId = (item: Pick<FilterItem, 'id' | 'type'>) =>
  `filter-${item.type}-${item.id}`;

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
  const [previewState, setPreviewState] = useState<{
    action: FilterPreviewAction;
    itemId: string;
  } | null>(null);

  const { builtInEntries, tagEntries } = useTagFilterEntries(indexJson);
  const statusEntries = useStatusFilterEntries(allStatuses);

  const filterCounts = useMemo(
    () =>
      computeFilterPanelCounts({
        allStatuses,
        includedFilters,
        excludedFilters,
        includedStatusFilters,
        excludedStatusFilters,
        indexJson,
        statusValues: statusEntries.map((entry) => entry.statusValue),
        tagIds: [
          ...builtInEntries.map((entry) => entry.id),
          ...tagEntries.map((entry) => entry.id),
        ],
      }),
    [
      allStatuses,
      builtInEntries,
      excludedFilters,
      excludedStatusFilters,
      includedFilters,
      includedStatusFilters,
      indexJson,
      statusEntries,
      tagEntries,
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
        visibleCount: filterCounts.tags[entry.id]?.visibleCount ?? 0,
        toggle: filterCounts.tags[entry.id]?.toggle ?? { delta: 0, visibleCount: 0 },
        invert: filterCounts.tags[entry.id]?.invert ?? { delta: 0, visibleCount: 0 },
        icon: entry.icon,
        isIncluded,
        isExcluded,
        onCheckboxChange: () => {
          if (isChecked) {
            api.removeTagFilters([entry.id]);
          } else {
            api.addTagFilters([entry.id], false);
          }
        },
        onInvert: () => api.addTagFilters([entry.id], !isExcluded),
      };
    },
    [api, excludedFilters, filterCounts.tags, includedFilters]
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
        visibleCount: filterCounts.statuses[entry.statusValue]?.visibleCount ?? 0,
        toggle: filterCounts.statuses[entry.statusValue]?.toggle ?? { delta: 0, visibleCount: 0 },
        invert: filterCounts.statuses[entry.statusValue]?.invert ?? { delta: 0, visibleCount: 0 },
        icon: statusIconEl ? <StatusIcon $iconColor={iconColor}>{statusIconEl}</StatusIcon> : null,
        isIncluded,
        isExcluded,
        onCheckboxChange: () => {
          if (isChecked) {
            api.removeStatusFilters([entry.statusValue]);
          } else {
            api.addStatusFilters([entry.statusValue], false);
          }
        },
        onInvert: () => api.addStatusFilters([entry.statusValue], !isExcluded),
      };
    },
    [api, excludedStatusFilters, filterCounts.statuses, includedStatusFilters, theme]
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

  const hasItems = builtInItems.length > 0 || tagItems.length > 0 || statusItems.length > 0;
  const allItems = useMemo(
    () => [...builtInItems, ...statusItems, ...tagItems],
    [builtInItems, statusItems, tagItems]
  );
  const previewAction = previewState?.action ?? null;
  const previewedItem = previewState
    ? allItems.find((item) => `filter-${item.type}-${item.id}` === previewState.itemId)
    : null;
  const previewedProjection = previewedItem && previewAction ? previewedItem[previewAction] : null;
  const summaryCount = previewedProjection?.visibleCount ?? filterCounts.currentVisibleCount;
  const summaryCountString = `${summaryCount}/${filterCounts.totalCount}`;
  const summaryAriaLabel =
    previewedItem && previewedProjection && previewAction
      ? `${summaryCount} of ${filterCounts.totalCount} items visible if ${getFilterPreviewDescription(
          previewedItem,
          previewAction
        )}`
      : `${summaryCount} of ${filterCounts.totalCount} items currently visible`;
  const summaryLabel = previewedProjection ? 'If applied' : 'Shown';
  const summaryDelta = previewedProjection?.delta ?? 0;

  const renderItem = useCallback(
    (item: FilterItem) => {
      const itemPreviewId = getItemPreviewId(item);
      const link = createFilterLink(item, {
        activePreviewAction: previewState?.itemId === itemPreviewId ? previewState.action : null,
        onPreviewEnd: () => {
          setPreviewState((current) => (current?.itemId === itemPreviewId ? null : current));
        },
        onPreviewStart: (action) => {
          setPreviewState({ action, itemId: itemPreviewId });
        },
      });

      return <Fragment key={link.id}>{link.content}</Fragment>;
    },
    [previewState]
  );

  return (
    <Wrapper>
      {hasItems && (
        <ActionList as="div">
          <ActionList.Item as="div">
            <SummaryRow>
              <span>{summaryLabel}</span>
              <SummaryCount
                aria-label={summaryAriaLabel}
                $delta={summaryDelta}
                $isPreview={Boolean(previewedProjection)}
              >
                <span aria-hidden>{summaryCountString}</span>
              </SummaryCount>
            </SummaryRow>
          </ActionList.Item>
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
      {builtInItems.length > 0 && <ActionList>{builtInItems.map(renderItem)}</ActionList>}
      {statusItems.length > 0 && <ActionList>{statusItems.map(renderItem)}</ActionList>}
      {tagItems.length > 0 && <ActionList>{tagItems.map(renderItem)}</ActionList>}
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
