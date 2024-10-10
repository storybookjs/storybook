import React, { useState, useEffect } from 'react';
import { Badge, IconButton, WithTooltip } from '@storybook/components';
import { FilterIcon } from '@storybook/icons';
import type { API } from '@storybook/manager-api';
import { styled } from '@storybook/theming';
import type { Tag, StoryIndex } from '@storybook/types';
import { TagsFilterPanel } from './TagsFilterPanel';

const TAGS_FILTER = 'tags-filter';

const Wrapper = styled.div({
  position: 'relative',
});

const Count = styled(Badge)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  right: 0,
  transform: 'translate(50%, -50%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 3,
  height: 15,
  minWidth: 15,
  lineHeight: '15px',
  fontSize: theme.typography.size.s1 - 1,
  background: theme.color.secondary,
  color: theme.color.lightest,
}));

export interface TagsFilterProps {
  api: API;
  indexJson: StoryIndex;
  updateQueryParams: (params: Record<string, string | null>) => void;
  initialSelectedTags?: Tag[];
}

export const TagsFilter = ({
  api,
  indexJson,
  updateQueryParams,
  initialSelectedTags = [],
}: TagsFilterProps) => {
  const [selectedTags, setSelectedTags] = useState(initialSelectedTags);
  const [exclude, setExclude] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const tagsActive = selectedTags.length > 0;

  useEffect(() => {
    api.experimental_setFilter(TAGS_FILTER, (item) => {
      if (selectedTags.length === 0) return true;

      const hasSelectedTags = selectedTags.some((tag) => item.tags?.includes(tag));
      return exclude ? !hasSelectedTags : hasSelectedTags;
    });

    const tagsParam = selectedTags.join(',');
    const [includeTags, excludeTags] = exclude ? [null, tagsParam] : [tagsParam, null];
    updateQueryParams({ includeTags, excludeTags });
  }, [api, selectedTags, exclude, updateQueryParams]);

  const allTags = Object.values(indexJson.entries).reduce((acc, entry) => {
    entry.tags?.forEach((tag: Tag) => acc.add(tag));
    return acc;
  }, new Set<Tag>());

  return (
    <WithTooltip
      placement="bottom"
      trigger="click"
      onVisibleChange={setExpanded}
      tooltip={() => (
        <TagsFilterPanel
          allTags={Array.from(allTags)}
          selectedTags={selectedTags}
          exclude={exclude}
          toggleTag={(tag) => {
            if (selectedTags.includes(tag)) {
              setSelectedTags(selectedTags.filter((t) => t !== tag));
            } else {
              setSelectedTags([...selectedTags, tag]);
            }
          }}
          toggleExclude={() => setExclude(!exclude)}
        />
      )}
    >
      <Wrapper>
        <IconButton
          key="tags"
          title="Tag filters"
          active={tagsActive}
          onClick={(event) => {
            event.preventDefault();
            setExpanded(!expanded);
          }}
        >
          <FilterIcon />
        </IconButton>
        {selectedTags.length > 0 && <Count>{selectedTags.length}</Count>}
      </Wrapper>
    </WithTooltip>
  );
};
