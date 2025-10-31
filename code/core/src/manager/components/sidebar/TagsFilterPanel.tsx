import React, { useRef } from 'react';

import {
  Button,
  Form,
  ListItem,
  TooltipLinkList,
  TooltipNote,
  WithTooltipNew,
} from 'storybook/internal/components';
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

const Actions = styled.div(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 4,
  padding: 4,
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

const TagRow = styled.div({
  display: 'flex',

  '& button:last-of-type': {
    width: 64,
    maxWidth: 64,
    marginLeft: 4,
    paddingLeft: 0,
    paddingRight: 0,
    fontWeight: 'normal',
    transition: 'max-width 150ms',
  },
  '&:not(:hover):not(:focus-within)': {
    '& button:last-of-type': {
      marginLeft: 0,
      maxWidth: 0,
      opacity: 0,
    },
    '& svg + input': {
      display: 'none',
    },
  },
});

const Label = styled.div({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
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
        <TagRow>
          <WithTooltipNew delayShow={1000} tooltip={<TooltipNote note={toggleTagLabel} />}>
            <ListItem
              style={{ minWidth: 0, flex: 1 }}
              onClick={() => onToggle(!isChecked)}
              icon={
                <>
                  {isExcluded ? <DeleteIcon /> : isIncluded ? null : icon}
                  <Form.Checkbox
                    checked={isChecked}
                    onChange={() => onToggle(!isChecked)}
                    data-tag={title}
                    aria-hidden={true}
                    tabIndex={-1}
                  />
                </>
              }
              aria-label={toggleTagLabel}
              title={
                <Label>
                  {title}
                  {isExcluded && <MutedText> (excluded)</MutedText>}
                </Label>
              }
              right={isExcluded ? <s>{count}</s> : <span>{count}</span>}
            />
          </WithTooltipNew>
          <Button
            variant="ghost"
            size="medium"
            onClick={() => onToggle(true, !isExcluded)}
            ariaLabel={invertButtonLabel}
          >
            {isExcluded ? 'Include' : 'Exclude'}
          </Button>
        </TagRow>
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
        href: api.getDocsUrl({ subpath: 'writing-stories/tags#filtering-by-custom-tags' }),
      },
    ]);
  }

  const isNothingSelectedYet = includedFilters.size === 0 && excludedFilters.size === 0;
  const filtersLabel = isNothingSelectedYet ? 'Select all' : 'Clear filters';

  return (
    <Wrapper ref={ref}>
      {Object.keys(filtersById).length > 0 && (
        <Actions>
          {isNothingSelectedYet ? (
            <Button
              ariaLabel={false}
              variant="ghost"
              padding="small"
              id="select-all"
              key="select-all"
              onClick={() => setAllFilters(true)}
            >
              <BatchAcceptIcon />
              {filtersLabel}
            </Button>
          ) : (
            <Button
              ariaLabel={false}
              variant="ghost"
              padding="small"
              id="deselect-all"
              key="deselect-all"
              onClick={() => setAllFilters(false)}
            >
              <SweepIcon />
              {filtersLabel}
            </Button>
          )}
          {hasDefaultSelection && (
            <Button
              id="reset-filters"
              key="reset-filters"
              onClick={resetFilters}
              ariaLabel="Reset filters"
              tooltip="Reset to default selection"
              disabled={isDefaultSelection}
            >
              <UndoIcon />
            </Button>
          )}
        </Actions>
      )}
      <TooltipLinkList links={links} />
    </Wrapper>
  );
};
