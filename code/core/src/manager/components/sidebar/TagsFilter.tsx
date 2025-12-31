import React, { useCallback, useState } from 'react';

import { Badge, Button, PopoverProvider } from 'storybook/internal/components';
import type { StoryIndex } from 'storybook/internal/types';

import { FilterIcon } from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { TagsFilterPanel } from './TagsFilterPanel';

const StyledButton = styled(Button)<{ isHighlighted: boolean }>(({ isHighlighted, theme }) => ({
  '&:focus-visible': {
    outlineOffset: 4,
  },
  ...(isHighlighted && {
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

export interface TagsFilterProps {
  api: API;
  indexJson: StoryIndex;
}

export const TagsFilter = ({ api, indexJson }: TagsFilterProps) => {
  const includedFilters = api.getIncludedTagFilters();
  const excludedFilters = api.getExcludedTagFilters();

  const [expanded, setExpanded] = useState(false);
  const activeFilterCount = includedFilters.length + excludedFilters.length;

  const handleToggleExpand = useCallback(
    (event: React.SyntheticEvent<Element, Event>): void => {
      event.preventDefault();
      setExpanded(!expanded);
    },
    [expanded, setExpanded]
  );

  return (
    <PopoverProvider
      placement="bottom"
      onVisibleChange={setExpanded}
      offset={8}
      padding={0}
      popover={() => <TagsFilterPanel api={api} indexJson={indexJson} />}
    >
      <StyledButton
        key="tags"
        ariaLabel={
          activeFilterCount
            ? `${activeFilterCount} active tag ${activeFilterCount !== 1 ? 'filters' : 'filter'}`
            : 'Tag filters'
        }
        ariaDescription="Filter the items shown in a sidebar based on the tags applied to them."
        aria-haspopup="dialog"
        variant="ghost"
        padding="small"
        isHighlighted={expanded}
        onClick={handleToggleExpand}
      >
        <FilterIcon />
        {activeFilterCount > 0 && <TagSelected />}
      </StyledButton>
    </PopoverProvider>
  );
};
