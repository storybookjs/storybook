import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge, Button, WithTooltip } from 'storybook/internal/components';
import type { StoryIndex, Tag } from 'storybook/internal/types';

import { FilterIcon } from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { TagsFilterPanel } from './TagsFilterPanel';

const TAGS_FILTER = 'tags-filter';

const BUILT_IN_TAGS_HIDE = new Set(['dev', 'autodocs', 'test', 'attached-mdx', 'unattached-mdx']);

const Wrapper = styled.div({
  position: 'relative',
});

// Temporary to prevent regressions until TagFilterPanel can be refactored.
const StyledIconButton = styled(Button)<{ active: boolean }>(({ active, theme }) => ({
  ...(active && {
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
  color: theme.textInverseColor,
}));

export interface TagsFilterProps {
  api: API;
  indexJson: StoryIndex;
  initialSelectedTags?: Tag[];
  isDevelopment: boolean;
}

export const TagsFilter = ({
  api,
  indexJson,
  initialSelectedTags = [],
  isDevelopment,
}: TagsFilterProps) => {
  const [selectedTags, setSelectedTags] = useState(initialSelectedTags);
  const [expanded, setExpanded] = useState(false);
  const [inverted, setInverted] = useState(false);
  const tagsActive = selectedTags.length > 0;

  useEffect(() => {
    api.experimental_setFilter(TAGS_FILTER, (item) => {
      if (selectedTags.length === 0) {
        return true;
      }
      const match = selectedTags.some((tag) => item.tags?.includes(tag));
      return inverted ? !match : match;
    });
  }, [api, selectedTags, inverted]);

  const allTags = Object.values(indexJson.entries).reduce((acc, entry) => {
    entry.tags?.forEach((tag: Tag) => {
      if (!BUILT_IN_TAGS_HIDE.has(tag)) {
        acc.set(tag, (acc.get(tag) || 0) + 1);
      }
    });
    return acc;
  }, new Map<Tag, number>());

  const toggleTag = useCallback(
    (tag: string) => {
      if (selectedTags.includes(tag)) {
        setSelectedTags(selectedTags.filter((t) => t !== tag));
      } else {
        setSelectedTags([...selectedTags, tag]);
      }
    },
    [selectedTags, setSelectedTags]
  );
  const setAllTags = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedTags(Array.from(allTags.keys()));
      } else {
        setSelectedTags([]);
        setInverted(false);
      }
    },
    [allTags, setSelectedTags]
  );

  const handleToggleExpand = useCallback(
    (event: React.SyntheticEvent<Element, Event>): void => {
      event.preventDefault();
      setExpanded(!expanded);
    },
    [expanded, setExpanded]
  );

  // Hide the entire UI if there are no tags and it's a built Storybook
  if (allTags.size === 0 && !isDevelopment) {
    return null;
  }

  return (
    <>
      <WithTooltip
        placement="bottom"
        trigger="click"
        onVisibleChange={setExpanded}
        // render the tooltip in the mobile menu (so that the stacking context is correct) and fallback to document.body on desktop
        portalContainer="#storybook-mobile-menu"
        tooltip={() => (
          <TagsFilterPanel
            api={api}
            allTags={allTags}
            selectedTags={selectedTags}
            toggleTag={toggleTag}
            setAllTags={setAllTags}
            inverted={inverted}
            setInverted={setInverted}
            isDevelopment={isDevelopment}
          />
        )}
        closeOnOutsideClick
      >
        <Wrapper>
          <StyledIconButton
            key="tags"
            ariaLabel="Tag filters"
            ariaDescription="Filter the items shown in a sidebar based on the tags applied to them."
            variant="ghost"
            padding="small"
            active={tagsActive}
            onClick={handleToggleExpand}
          >
            <FilterIcon />
          </StyledIconButton>
          {selectedTags.length > 0 && <TagSelected />}
        </Wrapper>
      </WithTooltip>
    </>
  );
};
