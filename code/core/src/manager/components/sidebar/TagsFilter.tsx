import React, { useCallback, useState } from 'react';

import { Badge, Button, PopoverProvider } from 'storybook/internal/components';
import type { StoryIndex } from 'storybook/internal/types';

import { FilterIcon } from '@storybook/icons';

import { type API, type Combo, Consumer } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { TagsFilterPanel } from './TagsFilterPanel';

const StyledButton = styled(Button)<{ $isHighlighted: boolean }>(({ $isHighlighted, theme }) => ({
  '&:focus-visible': {
    outlineOffset: 4,
  },
  ...($isHighlighted && {
    background: theme.background.hoverable,
    color: theme.color.secondary,
  }),
}));

const TagSelected = styled(Badge)(({ theme }) => ({
  position: 'absolute',
  top: 7,
  right: 7,
  transform: 'translate(50%, -50%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 3,
  height: 6,
  minWidth: 6,
  lineHeight: 'px',
  boxShadow: `${theme.barSelectedColor} 0 0 0 1px inset`,
  fontSize: theme.typography.size.s1 - 1,
  background: theme.barSelectedColor,
  color: theme.color.inverseText,
}));

const tagsFilterMapper = ({ api, state }: Combo) => ({
  api,
  indexJson: state.internal_index as StoryIndex | undefined,
  activeFilterCount:
    (state.includedTagFilters?.length ?? 0) + (state.excludedTagFilters?.length ?? 0),
  defaultIncludedFilters: state.defaultIncludedTagFilters,
  defaultExcludedFilters: state.defaultExcludedTagFilters,
  includedFilters: state.includedTagFilters,
  excludedFilters: state.excludedTagFilters,
});

interface TagsFilterInnerProps {
  api: API;
  indexJson: StoryIndex;
  activeFilterCount: number;
  defaultIncludedFilters: string[];
  defaultExcludedFilters: string[];
  includedFilters: string[];
  excludedFilters: string[];
}

const TagsFilterInner = ({
  api,
  indexJson,
  activeFilterCount,
  defaultIncludedFilters,
  defaultExcludedFilters,
  includedFilters,
  excludedFilters,
}: TagsFilterInnerProps) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggleExpand = useCallback(
    (event: React.SyntheticEvent<Element, Event>): void => {
      event.preventDefault();
      setExpanded(!expanded);
    },
    [expanded]
  );

  return (
    <PopoverProvider
      ariaLabel="Tag filters"
      placement="bottom"
      onVisibleChange={setExpanded}
      offset={8}
      padding={0}
      popover={() => (
        <TagsFilterPanel
          api={api}
          indexJson={indexJson}
          defaultIncludedFilters={defaultIncludedFilters}
          defaultExcludedFilters={defaultExcludedFilters}
          includedFilters={includedFilters}
          excludedFilters={excludedFilters}
        />
      )}
    >
      <StyledButton
        key="tags"
        ariaLabel={
          activeFilterCount
            ? `${activeFilterCount} active tag ${activeFilterCount !== 1 ? 'filters' : 'filter'}`
            : 'Tag filters'
        }
        ariaDescription="Filter the items shown in a sidebar based on the tags applied to them."
        variant="ghost"
        padding="small"
        $isHighlighted={activeFilterCount > 0}
        onClick={handleToggleExpand}
      >
        <FilterIcon />
        {activeFilterCount > 0 && <TagSelected />}
      </StyledButton>
    </PopoverProvider>
  );
};

export const TagsFilter = () => (
  <Consumer filter={tagsFilterMapper}>
    {({
      api,
      indexJson,
      activeFilterCount,
      defaultIncludedFilters,
      defaultExcludedFilters,
      includedFilters,
      excludedFilters,
    }) =>
      indexJson ? (
        <TagsFilterInner
          api={api}
          indexJson={indexJson}
          activeFilterCount={activeFilterCount}
          defaultIncludedFilters={defaultIncludedFilters}
          defaultExcludedFilters={defaultExcludedFilters}
          includedFilters={includedFilters}
          excludedFilters={excludedFilters}
        />
      ) : null
    }
  </Consumer>
);
