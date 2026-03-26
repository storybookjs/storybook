import React, { Fragment, useCallback, useMemo, useRef } from 'react';

import { ActionList } from 'storybook/internal/components';
import type { StatusValue, StatusesByStoryIdAndTypeId, StoryIndex } from 'storybook/internal/types';

import { BatchAcceptIcon, DocumentIcon, ShareAltIcon, SweepIcon, UndoIcon } from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import { FilterPanelItem } from './FilterPanelItem';
import { areFiltersEqual } from './FilterPanel.utils';
import { useStatusFilterItems, useTagFilterItems } from './useFilterData';

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
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const toggleFilter = useCallback(
    (id: string, selected: boolean, excluded?: boolean) => {
      if (excluded !== undefined) {
        api.addTagFilters([id], excluded);
      } else if (selected) {
        api.addTagFilters([id], false);
      } else {
        api.removeTagFilters([id]);
      }
    },
    [api]
  );

  const toggleStatusFilter = useCallback(
    (statusValue: StatusValue, excluded: boolean | undefined) => {
      if (excluded !== undefined) {
        api.addStatusFilters([statusValue], excluded);
      } else {
        api.removeStatusFilters([statusValue]);
      }
    },
    [api]
  );

  const { builtInItems, tagItems, filterIds } = useTagFilterItems({
    indexJson,
    includedFilters,
    excludedFilters,
    toggleFilter,
  });

  const statusItems = useStatusFilterItems({
    allStatuses,
    includedStatusFilters,
    excludedStatusFilters,
    toggleStatusFilter,
    theme,
  });

  const setAllFilters = useCallback(
    (selected: boolean) => {
      api.setAllTagFilters(selected ? filterIds : [], []);
    },
    [api, filterIds]
  );

  const isDefaultSelection = useMemo(() => {
    return (
      areFiltersEqual(includedFilters, defaultIncludedFilters) &&
      areFiltersEqual(excludedFilters, defaultExcludedFilters)
    );
  }, [includedFilters, excludedFilters, defaultIncludedFilters, defaultExcludedFilters]);

  const hasDefaultSelection = useMemo(() => {
    return defaultIncludedFilters.length > 0 || defaultExcludedFilters.length > 0;
  }, [defaultIncludedFilters, defaultExcludedFilters]);

  const isNothingSelectedYet = useMemo(() => {
    return (
      includedFilters.length === 0 &&
      excludedFilters.length === 0 &&
      includedStatusFilters.length === 0 &&
      excludedStatusFilters.length === 0
    );
  }, [includedFilters, excludedFilters, includedStatusFilters, excludedStatusFilters]);

  const hasItems = builtInItems.length > 0 || tagItems.length > 0;
  const hasStatusFilters = statusItems.length > 0;
  const hasUserTags = tagItems.length > 0;

  return (
    <Wrapper ref={ref}>
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
            const link = FilterPanelItem(item);
            return <Fragment key={link.id}>{link.content}</Fragment>;
          })}
        </ActionList>
      )}
      {hasStatusFilters && (
        <ActionList>
          {statusItems.map((item) => {
            const link = FilterPanelItem(item);
            return <Fragment key={link.id}>{link.content}</Fragment>;
          })}
        </ActionList>
      )}
      {tagItems.length > 0 && (
        <ActionList>
          {tagItems.map((item) => {
            const link = FilterPanelItem(item);
            return <Fragment key={link.id}>{link.content}</Fragment>;
          })}
        </ActionList>
      )}
      {!hasUserTags && (
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
