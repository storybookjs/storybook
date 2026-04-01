import React, { useCallback, useState } from 'react';

import { Badge, Button, PopoverProvider } from 'storybook/internal/components';
import type { StatusesByStoryIdAndTypeId, StoryIndex } from 'storybook/internal/types';
import type { StatusValue } from 'storybook/internal/types';

import { FilterIcon } from '@storybook/icons';

import { type API, type Combo, Consumer, experimental_useStatusStore } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { FilterPanel } from './FilterPanel';

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

const filterMapper = ({ api, state }: Combo) => ({
  api,
  indexJson: state.internal_index as StoryIndex | undefined,
  activeFilterCount:
    (state.includedTagFilters?.length ?? 0) +
    (state.excludedTagFilters?.length ?? 0) +
    (state.includedStatusFilters?.length ?? 0) +
    (state.excludedStatusFilters?.length ?? 0),
  defaultIncludedFilters: state.defaultIncludedTagFilters,
  defaultExcludedFilters: state.defaultExcludedTagFilters,
  includedFilters: state.includedTagFilters,
  excludedFilters: state.excludedTagFilters,
  includedStatusFilters: (state.includedStatusFilters ?? []) as StatusValue[],
  excludedStatusFilters: (state.excludedStatusFilters ?? []) as StatusValue[],
});

interface FilterInnerProps {
  api: API;
  indexJson: StoryIndex;
  activeFilterCount: number;
  defaultIncludedFilters: string[];
  defaultExcludedFilters: string[];
  includedFilters: string[];
  excludedFilters: string[];
  includedStatusFilters: StatusValue[];
  excludedStatusFilters: StatusValue[];
}

const FilterInner = ({
  api,
  indexJson,
  activeFilterCount,
  defaultIncludedFilters,
  defaultExcludedFilters,
  includedFilters,
  excludedFilters,
  includedStatusFilters,
  excludedStatusFilters,
}: FilterInnerProps) => {
  const [expanded, setExpanded] = useState(false);
  const allStatuses = experimental_useStatusStore() as StatusesByStoryIdAndTypeId;

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
        <FilterPanel
          api={api}
          indexJson={indexJson}
          defaultIncludedFilters={defaultIncludedFilters}
          defaultExcludedFilters={defaultExcludedFilters}
          includedFilters={includedFilters}
          excludedFilters={excludedFilters}
          allStatuses={allStatuses}
          includedStatusFilters={includedStatusFilters}
          excludedStatusFilters={excludedStatusFilters}
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

export const Filter = () => (
  <Consumer filter={filterMapper}>
    {({
      api,
      indexJson,
      activeFilterCount,
      defaultIncludedFilters,
      defaultExcludedFilters,
      includedFilters,
      excludedFilters,
      includedStatusFilters,
      excludedStatusFilters,
    }) =>
      indexJson ? (
        <FilterInner
          api={api}
          indexJson={indexJson}
          activeFilterCount={activeFilterCount}
          defaultIncludedFilters={defaultIncludedFilters}
          defaultExcludedFilters={defaultExcludedFilters}
          includedFilters={includedFilters}
          excludedFilters={excludedFilters}
          includedStatusFilters={includedStatusFilters}
          excludedStatusFilters={excludedStatusFilters}
        />
      ) : null
    }
  </Consumer>
);
