import React, { Fragment, useCallback, useMemo, useRef } from 'react';

import { ActionList, Form } from 'storybook/internal/components';
import type {
  FilterFunction,
  StatusValue,
  StatusesByStoryIdAndTypeId,
  StoryIndex,
  Tag,
} from 'storybook/internal/types';

import {
  BatchAcceptIcon,
  BeakerIcon,
  DeleteIcon,
  DocumentIcon,
  PlayHollowIcon,
  ShareAltIcon,
  SweepIcon,
  UndoIcon,
} from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { color, styled, useTheme } from 'storybook/theming';

import { getStatus } from '../../utils/status';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList';
import { BUILT_IN_FILTERS, USER_TAG_FILTER } from '../../../shared/constants/tags';

type FilterItem = {
  id: string;
  type: string;
  title: string;
  count: number;
  icon: React.ReactElement | null;
  isIncluded: boolean;
  isExcluded: boolean;
  onCheckboxChange: () => void;
  onInvert: () => void;
};

const Wrapper = styled.div({
  minWidth: 240,
  maxWidth: 300,
  maxHeight: 15.5 * 32 + 8, // 15.5 items at 32px each + 8px padding
  overflow: 'hidden',
  overflowY: 'auto',
  scrollbarWidth: 'thin',
});

const MutedText = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
}));

interface FilterPanelProps {
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

/* Those tags are hidden in the UI. There's a more general built-in list defined in `shared/constants/tags`. */
const BUILT_IN_TAGS = new Set([
  'dev',
  'test',
  'autodocs',
  'attached-mdx',
  'unattached-mdx',
  'play-fn',
  'test-fn',
  'manifest',
]);

const STATUS_DISPLAY_ORDER: Array<{ shortName: string; statusValue: StatusValue }> = [
  { shortName: 'new', statusValue: 'status-value:new' },
  { shortName: 'modified', statusValue: 'status-value:modified' },
  { shortName: 'affected', statusValue: 'status-value:affected' },
  { shortName: 'error', statusValue: 'status-value:error' },
  { shortName: 'warning', statusValue: 'status-value:warning' },
  { shortName: 'success', statusValue: 'status-value:success' },
  { shortName: 'pending', statusValue: 'status-value:pending' },
  { shortName: 'unknown', statusValue: 'status-value:unknown' },
];

// This equality check works on the basis that there are no duplicates in the arrays.
// We use arrays because we need arrays for data persistence in the layout module.
const equal = (left: string[], right: string[]) =>
  left.length === right.length && new Set([...left, ...right]).size === left.length;

const getFilterFunction = (tag: Tag): FilterFunction | null => {
  if (Object.hasOwn(BUILT_IN_FILTERS, tag)) {
    return BUILT_IN_FILTERS[tag as keyof typeof BUILT_IN_FILTERS];
  } else {
    return USER_TAG_FILTER(tag);
  }
};

const StatusIcon = styled.span<{ $color: string | null }>(({ $color }) => ({
  display: 'contents',
  ...($color ? { color: $color } : {}),
}));

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

  const statusCounts = useMemo<Record<StatusValue, number>>(() => {
    const counts = {} as Record<StatusValue, number>;
    Object.values(allStatuses).forEach((statusByTypeId) => {
      Object.values(statusByTypeId).forEach((status) => {
        counts[status.value] = (counts[status.value] ?? 0) + 1;
      });
    });
    return counts;
  }, [allStatuses]);

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
        icon: <DocumentIcon color={color.gold} />,
        count: getBuiltInCount(getFilterFunction('_docs')),
      },
      _play: {
        id: '_play',
        type: 'built-in',
        title: 'Play',
        icon: <PlayHollowIcon color={color.seafoam} />,
        count: getBuiltInCount(getFilterFunction('_play')),
      },
      _test: {
        id: '_test',
        type: 'built-in',
        title: 'Testing',
        icon: <BeakerIcon color={color.green} />,
        count: getBuiltInCount(getFilterFunction('_test')),
      },
    };

    return { ...userFilters, ...builtInFilters };
  }, [indexJson.entries]);

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

  const setAllFilters = useCallback(
    (selected: boolean) => {
      api.setAllTagFilters(selected ? Object.keys(filtersById) : [], []);
    },
    [api, filtersById]
  );

  const isDefaultSelection = useMemo(() => {
    return (
      equal(includedFilters, defaultIncludedFilters) &&
      equal(excludedFilters, defaultExcludedFilters)
    );
  }, [includedFilters, excludedFilters, defaultIncludedFilters, defaultExcludedFilters]);

  const hasDefaultSelection = useMemo(() => {
    return defaultIncludedFilters.length > 0 || defaultExcludedFilters.length > 0;
  }, [defaultIncludedFilters, defaultExcludedFilters]);

  const builtInFilterIcons = useMemo(
    () => ({
      _docs: <DocumentIcon color={color.gold} />,
      _play: <PlayHollowIcon color={color.seafoam} />,
      _test: <BeakerIcon color={color.green} />,
    }),
    []
  );

  const renderLink = ({
    id,
    type,
    title,
    count,
    icon,
    isIncluded,
    isExcluded,
    onCheckboxChange,
    onInvert,
  }: FilterItem): Link => {
    const isChecked = isIncluded || isExcluded;
    const toggleLabel = `${type} filter: ${isExcluded ? `exclude ${title}` : title}`;
    const toggleTooltip = `${isChecked ? 'Remove' : 'Add'} ${type} filter: ${title}`;
    const invertButtonLabel = `${isExcluded ? 'Include' : 'Exclude'} ${type}: ${title}`;

    return {
      id: `filter-${type}-${id}`,
      content: (
        <ActionList.HoverItem targetId={`filter-${type}-${id}`}>
          <ActionList.Action as="label" ariaLabel={false} tabIndex={-1} tooltip={toggleTooltip}>
            <ActionList.Icon>
              {isExcluded ? <DeleteIcon /> : isIncluded ? null : icon}
              <Form.Checkbox
                checked={isChecked}
                onChange={onCheckboxChange}
                data-tag={title}
                aria-label={toggleLabel}
              />
            </ActionList.Icon>
            <ActionList.Text>
              <span>
                {title}
                {isExcluded && <MutedText> (excluded)</MutedText>}
              </span>
            </ActionList.Text>
            {isExcluded ? <s>{count}</s> : <span>{count}</span>}
          </ActionList.Action>
          <ActionList.Button
            data-target-id={`filter-${type}-${id}`}
            ariaLabel={invertButtonLabel}
            onClick={onInvert}
          >
            <span style={{ minWidth: 45 }}>{isExcluded ? 'Include' : 'Exclude'}</span>
          </ActionList.Button>
        </ActionList.HoverItem>
      ),
    };
  };

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

  const statusItems = STATUS_DISPLAY_ORDER.map(({ shortName, statusValue }) => {
    const count = statusCounts[statusValue] ?? 0;
    if (count === 0) return null;
    const isIncluded = includedStatusFilters.includes(statusValue);
    const isExcluded = excludedStatusFilters.includes(statusValue);
    const isChecked = isIncluded || isExcluded;
    const { icon: statusIconEl, iconColor } = getStatus(theme, statusValue);
    const icon = statusIconEl ? <StatusIcon $color={iconColor}>{statusIconEl}</StatusIcon> : null;
    return {
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
  }).filter((f): f is FilterItem => f !== null);

  const hasItems = builtInItems.length > 0 || tagItems.length > 0;
  const hasUserTags = tagItems.length > 0;
  const hasStatusFilters = statusItems.length > 0;
  const isNothingSelectedYet = useMemo(() => {
    return (
      includedFilters.length === 0 &&
      excludedFilters.length === 0 &&
      includedStatusFilters.length === 0 &&
      excludedStatusFilters.length === 0
    );
  }, [includedFilters, excludedFilters, includedStatusFilters, excludedStatusFilters]);

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
            const link = renderLink(item);
            return <Fragment key={link.id}>{link.content}</Fragment>;
          })}
        </ActionList>
      )}
      {hasStatusFilters && (
        <ActionList>
          {statusItems.map((item) => {
            const link = renderLink(item);
            return <Fragment key={link.id}>{link.content}</Fragment>;
          })}
        </ActionList>
      )}
      {tagItems.length > 0 && (
        <ActionList>
          {tagItems.map((item) => {
            const link = renderLink(item);
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
