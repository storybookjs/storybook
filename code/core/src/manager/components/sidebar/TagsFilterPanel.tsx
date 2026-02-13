import React, { Fragment, useCallback, useMemo, useRef } from 'react';

import { ActionList, Form } from 'storybook/internal/components';
import type { FilterFunction, StoryIndex, Tag } from 'storybook/internal/types';

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
import { color, styled } from 'storybook/theming';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList';

type Filter = {
  id: string;
  type: string;
  title: string;
  count: number;
};

export const groupByType = (filters: Filter[]) =>
  filters.reduce(
    (acc, filter) => {
      acc[filter.type] = acc[filter.type] || [];
      acc[filter.type].push(filter);
      return acc;
    },
    {} as Record<string, Filter[]>
  );

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

interface TagsFilterPanelProps {
  api: API;
  indexJson: StoryIndex;
}

const BUILT_IN_TAGS = new Set([
  'dev',
  'test',
  'autodocs',
  'attached-mdx',
  'unattached-mdx',
  'play-fn',
  'test-fn',
]);

// This equality check works on the basis that there are no duplicates in the arrays.
// We use arrays because we need arrays for data persistence in the layout module.
const equal = (left: string[], right: string[]) =>
  left.length === right.length && new Set([...left, ...right]).size === left.length;

export const TagsFilterPanel = ({ api, indexJson }: TagsFilterPanelProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const defaultIncluded = api.getDefaultIncludedTagFilters();
  const defaultExcluded = api.getDefaultExcludedTagFilters();
  const includedFilters = api.getIncludedTagFilters();
  const excludedFilters = api.getExcludedTagFilters();

  const filtersById = useMemo<{ [id: string]: Filter }>(() => {
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
        count: getBuiltInCount(api.getFilterFunction('_docs')),
      },
      _play: {
        id: '_play',
        type: 'built-in',
        title: 'Play',
        icon: <PlayHollowIcon color={color.seafoam} />,
        count: getBuiltInCount(api.getFilterFunction('_play')),
      },
      _test: {
        id: '_test',
        type: 'built-in',
        title: 'Testing',
        icon: <BeakerIcon color={color.green} />,
        count: getBuiltInCount(api.getFilterFunction('_test')),
      },
    };

    return { ...userFilters, ...builtInFilters };
  }, [api, indexJson.entries]);

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

  const setAllFilters = useCallback(
    (selected: boolean) => {
      api.setAllTagFilters(selected ? Object.keys(filtersById) : [], []);
    },
    [api, filtersById]
  );

  const isDefaultSelection = useMemo(() => {
    return equal(includedFilters, defaultIncluded) && equal(excludedFilters, defaultExcluded);
  }, [includedFilters, excludedFilters, defaultIncluded, defaultExcluded]);

  const hasDefaultSelection = useMemo(() => {
    return defaultIncluded.length > 0 || defaultExcluded.length > 0;
  }, [defaultIncluded, defaultExcluded]);

  const builtInFilterIcons = useMemo(
    () => ({
      _docs: <DocumentIcon color={color.gold} />,
      _play: <PlayHollowIcon color={color.seafoam} />,
      _test: <BeakerIcon color={color.green} />,
    }),
    []
  );

  const renderLink = ({ id, type, title, count }: Filter): Link | undefined => {
    const onToggle = (selected: boolean, excluded?: boolean) =>
      toggleFilter(id, selected, excluded);
    const isIncluded = includedFilters.includes(id);
    const isExcluded = excludedFilters.includes(id);
    const isChecked = isIncluded || isExcluded;
    const toggleLabel = `${type} filter: ${isExcluded ? `exclude ${title}` : title}`;
    const toggleTooltip = `${isChecked ? 'Remove' : 'Add'} ${type} filter: ${title}`;
    const invertButtonLabel = `${isExcluded ? 'Include' : 'Exclude'} ${type}: ${title}`;
    const icon =
      type === 'built-in' ? builtInFilterIcons[id as keyof typeof builtInFilterIcons] : null;

    // for built-in filters (docs, play, test), don't show if there are no matches
    if (count === 0 && type === 'built-in') {
      return undefined;
    }

    return {
      id: `filter-${type}-${id}`,
      content: (
        <ActionList.HoverItem targetId={`filter-${type}-${id}`}>
          <ActionList.Action as="label" ariaLabel={false} tabIndex={-1} tooltip={toggleTooltip}>
            <ActionList.Icon>
              {isExcluded ? <DeleteIcon /> : isIncluded ? null : icon}
              <Form.Checkbox
                checked={isChecked}
                onChange={() => onToggle(!isChecked)}
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
            onClick={() => onToggle(true, !isExcluded)}
          >
            <span style={{ minWidth: 45 }}>{isExcluded ? 'Include' : 'Exclude'}</span>
          </ActionList.Button>
        </ActionList.HoverItem>
      ),
    };
  };

  const groups = groupByType(Object.values(filtersById));
  const links: Link[][] = Object.values(groups)
    .map((group) =>
      group
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((filter) => renderLink(filter))
        .filter((value): value is Link => !!value)
    )
    .filter((value): value is Link[] => value.length > 0);

  const hasItems = links.length > 0;
  const hasUserTags = Object.values(filtersById).some(({ type }) => type === 'tag');
  const isNothingSelectedYet = includedFilters.length === 0 && excludedFilters.length === 0;

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
                onClick={() => setAllFilters(false)}
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
      {links.map((group) => (
        <ActionList key={group.map((link) => link.id).join('_')}>
          {group.map((link) => (
            <Fragment key={link.id}>{link.content}</Fragment>
          ))}
        </ActionList>
      ))}
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
