import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge, IconButton, WithTooltip } from 'storybook/internal/components';
import type { StoryIndex, Tag, TagsOptions } from 'storybook/internal/types';

import { FilterIcon } from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

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
  isDevelopment: boolean;
  tagPresets: TagsOptions;
}

export const TagsFilter = ({ api, indexJson, isDevelopment, tagPresets }: TagsFilterProps) => {
  const allTags = useMemo(() => {
    return Object.values(indexJson.entries).reduce((acc, entry) => {
      entry.tags?.forEach((tag: Tag) => {
        if (!BUILT_IN_TAGS_HIDE.has(tag)) {
          acc.set(tag, (acc.get(tag) || 0) + 1);
        }
      });
      return acc;
    }, new Map<Tag, number>());
  }, [indexJson.entries]);

  const { defaultIncluded, defaultExcluded } = useMemo(() => {
    return Object.entries(tagPresets).reduce(
      (acc, [tag, { defaultSelection }]) => {
        if (defaultSelection === 'include') {
          acc.defaultIncluded.add(tag);
        } else if (defaultSelection === 'exclude') {
          acc.defaultExcluded.add(tag);
        }
        return acc;
      },
      { defaultIncluded: new Set<Tag>(), defaultExcluded: new Set<Tag>() }
    );
  }, [tagPresets]);

  const [includedTags, setIncludedTags] = useState<Set<Tag>>(defaultIncluded);
  const [excludedTags, setExcludedTags] = useState<Set<Tag>>(defaultExcluded);
  const [expanded, setExpanded] = useState(false);
  const tagsActive = includedTags.size > 0 || excludedTags.size > 0;

  const resetTags = useCallback(() => {
    setIncludedTags(defaultIncluded);
    setExcludedTags(defaultExcluded);
  }, [defaultIncluded, defaultExcluded]);

  useEffect(resetTags, [resetTags]);

  useEffect(() => {
    api.experimental_setFilter(TAGS_FILTER, (item) => {
      if (!includedTags.size && !excludedTags.size) {
        return true;
      }
      return (
        (!includedTags.size || includedTags.values().some((tag) => item.tags?.includes(tag))) &&
        (!excludedTags.size || excludedTags.values().every((tag) => !item.tags?.includes(tag)))
      );
    });
  }, [api, includedTags, excludedTags]);

  const toggleTag = useCallback(
    (tag: string, excluded?: boolean) => {
      const set = new Set([tag]);
      if (excluded === true) {
        setExcludedTags(excludedTags.union(set));
        setIncludedTags(includedTags.difference(set));
      } else if (excluded === false) {
        setIncludedTags(includedTags.union(set));
        setExcludedTags(excludedTags.difference(set));
      } else if (includedTags.has(tag)) {
        setIncludedTags(includedTags.difference(set));
      } else if (excludedTags.has(tag)) {
        setExcludedTags(excludedTags.difference(set));
      } else {
        setIncludedTags(includedTags.union(set));
      }
    },
    [includedTags, excludedTags]
  );

  const setAllTags = useCallback(
    (selected: boolean) => {
      if (selected) {
        setIncludedTags(new Set(allTags.keys()));
      } else {
        setIncludedTags(new Set());
      }
      setExcludedTags(new Set());
    },
    [allTags]
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
      // render the tooltip in the mobile menu (so that the stacking context is correct) and fallback to document.body on desktop
      portalContainer="#storybook-mobile-menu"
      tooltip={() => (
        <TagsFilterPanel
          api={api}
          allTags={allTags}
          includedTags={includedTags}
          excludedTags={excludedTags}
          toggleTag={toggleTag}
          setAllTags={setAllTags}
          resetTags={resetTags}
          isDevelopment={isDevelopment}
          isDefaultSelection={
            includedTags.symmetricDifference(defaultIncluded).size === 0 &&
            excludedTags.symmetricDifference(defaultExcluded).size === 0
          }
          hasDefaultSelection={defaultIncluded.size > 0 || defaultExcluded.size > 0}
        />
      )}
      closeOnOutsideClick
    >
      <Wrapper>
        <IconButton key="tags" title="Tag filters" active={tagsActive} onClick={handleToggleExpand}>
          <FilterIcon />
        </IconButton>
        {includedTags.size + excludedTags.size > 0 && <TagSelected />}
      </Wrapper>
    </WithTooltip>
  );
};
