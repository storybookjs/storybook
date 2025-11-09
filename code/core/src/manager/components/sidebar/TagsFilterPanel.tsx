import React, { useRef } from 'react';

import {
  Button,
  Form,
  IconButton,
  ListItem,
  TooltipLinkList,
  TooltipNote,
  WithTooltip,
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

  '& button': {
    width: 64,
    maxWidth: 64,
    marginLeft: 4,
    paddingLeft: 0,
    paddingRight: 0,
    fontWeight: 'normal',
    transition: 'all 150ms',
  },
  '&:not(:hover)': {
    '& button': {
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
          <WithTooltip
            delayShow={1000}
            hasChrome={false}
            style={{ minWidth: 0, flex: 1 }}
            tooltip={<TooltipNote note={toggleTagLabel} />}
            trigger="hover"
          >
            <ListItem
              as="label"
              icon={
                <>
                  {isExcluded ? <DeleteIcon /> : isIncluded ? null : icon}
                  <Form.Checkbox
                    checked={isChecked}
                    onChange={() => onToggle(!isChecked)}
                    data-tag={title}
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
          </WithTooltip>
          <WithTooltip
            delayShow={1000}
            hasChrome={false}
            tooltip={<TooltipNote note={invertButtonLabel} />}
            trigger="hover"
          >
            <Button
              variant="ghost"
              size="medium"
              onClick={() => onToggle(true, !isExcluded)}
              aria-label={invertButtonLabel}
            >
              {isExcluded ? 'Include' : 'Exclude'}
            </Button>
          </WithTooltip>
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
        href: api.getDocsUrl({ subpath: 'writing-stories/tags#custom-tags' }),
      },
    ]);
  }

  const filtersLabel =
    includedFilters.size === 0 && excludedFilters.size === 0 ? 'Select all' : 'Clear filters';

  return (
    <Wrapper ref={ref}>
      {Object.keys(filtersById).length > 0 && (
        <Actions>
          {includedFilters.size === 0 && excludedFilters.size === 0 ? (
            <IconButton
              id="select-all"
              aria-label={filtersLabel}
              key="select-all"
              onClick={() => setAllFilters(true)}
            >
              <BatchAcceptIcon />
              {filtersLabel}
            </IconButton>
          ) : (
            <IconButton
              id="deselect-all"
              aria-label={filtersLabel}
              key="deselect-all"
              onClick={() => setAllFilters(false)}
            >
              <SweepIcon />
              {filtersLabel}
            </IconButton>
          )}
          {hasDefaultSelection && (
            <WithTooltip
              delayShow={1000}
              hasChrome={false}
              tooltip={<TooltipNote note="Reset to default selection" />}
              trigger="hover"
            >
              <IconButton
                id="reset-filters"
                key="reset-filters"
                onClick={resetFilters}
                aria-label="Reset filters"
                disabled={isDefaultSelection}
              >
                <UndoIcon />
              </IconButton>
            </WithTooltip>
          )}
        </Actions>
      )}
      <TooltipLinkList links={links} />
    </Wrapper>
  );
};
