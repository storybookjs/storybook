import React, { Fragment, useRef } from 'react';

import { ActionsList, Form } from 'storybook/internal/components';
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
});

const MutedText = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
}));

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
  isDevelopment: boolean;
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
  isDevelopment,
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
    const toggleTagLabel = `${isChecked ? 'Remove' : 'Add'} ${type} filter: ${title}`;
    const invertButtonLabel = `${isExcluded ? 'Include' : 'Exclude'} ${type}: ${title}`;

    // for built-in filters (docs, play, test), don't show if there are no matches
    if (count === 0 && type === 'built-in') {
      return undefined;
    }

    return {
      id: `filter-${type}-${id}`,
      content: (
        <ActionsList.HoverItem targetId={`filter-${type}-${id}`}>
          <ActionsList.Action as="label" tabIndex={-1} tooltip={toggleTagLabel}>
            <ActionsList.Icon>
              {isExcluded ? <DeleteIcon /> : isIncluded ? null : icon}
              <Form.Checkbox
                checked={isChecked}
                onChange={() => onToggle(!isChecked)}
                data-tag={title}
                aria-label={toggleTagLabel}
              />
            </ActionsList.Icon>
            <ActionsList.Text>
              <span>
                {title}
                {isExcluded && <MutedText> (excluded)</MutedText>}
              </span>
            </ActionsList.Text>
            {isExcluded ? <s>{count}</s> : <span>{count}</span>}
          </ActionsList.Action>
          <ActionsList.Button
            data-target-id={`filter-${type}-${id}`}
            ariaLabel={invertButtonLabel}
            onClick={() => onToggle(true, !isExcluded)}
          >
            <span style={{ minWidth: 45 }}>{isExcluded ? 'Include' : 'Exclude'}</span>
          </ActionsList.Button>
        </ActionsList.HoverItem>
      ),
    };
  };

  const groups = groupByType(Object.values(filtersById));
  const links: Link[][] = Object.values(groups).map(
    (group) =>
      group
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((filter) => renderLink(filter))
        .filter(Boolean) as Link[]
  );

  if (!groups.tag?.length && isDevelopment) {
    links.push([
      {
        id: 'tags-docs',
        title: 'Learn how to add tags',
        icon: <DocumentIcon />,
        right: <ShareAltIcon />,
        href: api.getDocsUrl({ subpath: 'writing-stories/tags#custom-tags' }),
      },
    ]);
  }

  const isNothingSelectedYet = includedFilters.size === 0 && excludedFilters.size === 0;
  const filtersLabel = isNothingSelectedYet ? 'Select all' : 'Clear filters';

  return (
    <Wrapper ref={ref}>
      {Object.keys(filtersById).length > 0 && (
        <ActionsList>
          <ActionsList.Item>
            {isNothingSelectedYet ? (
              <ActionsList.Button
                ariaLabel={false}
                id="select-all"
                key="select-all"
                onClick={() => setAllFilters(true)}
              >
                <BatchAcceptIcon />
                <ActionsList.Text>{filtersLabel}</ActionsList.Text>
              </ActionsList.Button>
            ) : (
              <ActionsList.Button
                ariaLabel={false}
                id="deselect-all"
                key="deselect-all"
                onClick={() => setAllFilters(false)}
              >
                <SweepIcon />
                {filtersLabel}
              </ActionsList.Button>
            )}
            {hasDefaultSelection && (
              <ActionsList.Button
                id="reset-filters"
                key="reset-filters"
                onClick={resetFilters}
                ariaLabel="Reset filters"
                tooltip="Reset to default selection"
                disabled={isDefaultSelection}
              >
                <UndoIcon />
              </ActionsList.Button>
            )}
          </ActionsList.Item>
        </ActionsList>
      )}
      {links.map((group) => (
        <ActionsList key={group.map((link) => link.id).join('_')}>
          {group.map((link) => (
            <Fragment key={link.id}>{link.content}</Fragment>
          ))}
        </ActionsList>
      ))}
    </Wrapper>
  );
};
