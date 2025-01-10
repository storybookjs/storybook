import React, { useCallback, useEffect, useState } from 'react';

import { Badge, IconButton, WithTooltip } from '@storybook/core/components';
import { styled } from '@storybook/core/theming';
import { FilterIcon } from '@storybook/icons';
import type { StoryIndex, Tag } from '@storybook/types';

import type { API } from '@storybook/core/manager-api';

import { TagsFilterPanel } from './TagsFilterPanel';

const TAGS_FILTER = 'tags-filter';

const BUILT_IN_TAGS_HIDE = new Set([
  'dev',
  'docs-only',
  'test-only',
  'autodocs',
  'test',
  'attached-mdx',
  'unattached-mdx',
]);

const Wrapper = styled.div({
  position: 'relative',
});

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
  background: theme.color.secondary,
  color: theme.color.lightest,
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
  const tagsActive = selectedTags.length > 0;

  useEffect(() => {
    api.experimental_setFilter(TAGS_FILTER, (item) => {
      if (selectedTags.length === 0) {
        return true;
      }

      return selectedTags.some((tag) => item.tags?.includes(tag));
    });
  }, [api, selectedTags]);

  const allTags = Object.values(indexJson.entries).reduce((acc, entry) => {
    entry.tags?.forEach((tag: Tag) => {
      if (!BUILT_IN_TAGS_HIDE.has(tag)) {
        acc.add(tag);
      }
    });
    return acc;
  }, new Set<Tag>());

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
    <WithTooltip
      placement="bottom"
      trigger="click"
      onVisibleChange={setExpanded}
      tooltip={() => (
        <TagsFilterPanel
          api={api}
          allTags={Array.from(allTags).toSorted()}
          selectedTags={selectedTags}
          toggleTag={toggleTag}
          isDevelopment={isDevelopment}
        />
      )}
      closeOnOutsideClick
    >
      <Wrapper>
        <IconButton key="tags" title="Tag filters" active={tagsActive} onClick={handleToggleExpand}>
          <FilterIcon />
        </IconButton>
        {selectedTags.length > 0 && <TagSelected />}
      </Wrapper>
    </WithTooltip>
  );
};
