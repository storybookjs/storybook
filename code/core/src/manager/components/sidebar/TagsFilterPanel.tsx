import React, { Fragment, useRef } from 'react';

import { ActionList, Form } from 'storybook/internal/components';
import type { API_PreparedIndexEntry } from 'storybook/internal/types';

import {
  BatchAcceptIcon,
  DeleteIcon,
  DocumentIcon,
  ShareAltIcon,
  SweepIcon,
  UndoIcon,
} from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList';

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

const MutedText = styled.span({
  color: 'var(--sb-textMutedColor)',
});

export type FilterFunction = (entry: API_PreparedIndexEntry, excluded?: boolean) => boolean;
export type Filter = {
  id: string;
  type: string;
  title: string;
  count: number;
  filterFn: FilterFunction;
};

interface TagsFilterPanelProps {
  api: API;
  filtersById: { [id: string]: Filter };
  includedFilters: Set<string>;
  excludedFilters: Set<string>;
  toggleFilter: (key: string, selected: boolean, excluded?: boolean) => void;
  setAllFilters: (selected: boolean) => void;
  resetFilters: () => void;
  isDefaultSelection: boolean;
  hasDefaultSelection: boolean;
}

export const TagsFilterPanel = ({
  api,
  filtersById,
  includedFilters,
  excludedFilters,
  toggleFilter,
  setAllFilters,
  resetFilters,
  isDefaultSelection,
  hasDefaultSelection,
}: TagsFilterPanelProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const renderLink = ({
    id,
    type,
    title,
    icon,
    count,
  }: {
    id: string;
    type: string;
    title: string;
    icon?: React.ReactNode;
    count: number;
  }): Link | undefined => {
    const onToggle = (selected: boolean, excluded?: boolean) =>
      toggleFilter(id, selected, excluded);
    const isIncluded = includedFilters.has(id);
    const isExcluded = excludedFilters.has(id);
    const isChecked = isIncluded || isExcluded;
    const toggleLabel = `${type} filter: ${isExcluded ? `exclude ${title}` : title}`;
    const toggleTooltip = `${isChecked ? 'Remove' : 'Add'} ${type} filter: ${title}`;
    const invertButtonLabel = `${isExcluded ? 'Include' : 'Exclude'} ${type}: ${title}`;

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
  const isNothingSelectedYet = includedFilters.size === 0 && excludedFilters.size === 0;

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
                onClick={resetFilters}
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
