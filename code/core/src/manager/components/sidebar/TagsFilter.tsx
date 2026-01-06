import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge, Button, PopoverProvider } from 'storybook/internal/components';
import type {
  API_PreparedIndexEntry,
  StoryIndex,
  TagsOptions,
} from 'storybook/internal/types';

import { BeakerIcon, DocumentIcon, FilterIcon, PlayHollowIcon } from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { Tag } from 'storybook/manager-api';
import { color, styled } from 'storybook/theming';

import { type Filter, type FilterFunction, TagsFilterPanel, groupByType } from './TagsFilterPanel';

const TAGS_FILTER = 'tags-filter';

const BUILT_IN_TAGS = new Set<string>(Object.values(Tag));

const StyledButton = styled(Button)<{ isHighlighted: boolean }>(({ isHighlighted, theme }) => ({
  '&:focus-visible': {
    outlineOffset: 4,
  },
  ...(isHighlighted && {
    background: theme.background.hoverable,
    color: theme.color.secondary,
  }),
}));

// Immutable set operations
const add = (set: Set<string>, id: string) => {
  const copy = new Set(set);
  copy.add(id);
  return copy;
};
const remove = (set: Set<string>, id: string) => {
  const copy = new Set(set);
  copy.delete(id);
  return copy;
};
const equal = (left: Set<string>, right: Set<string>) =>
  left.size === right.size && new Set([...left, ...right]).size === left.size;

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
  tagPresets: TagsOptions;
}

export const TagsFilter = ({ api, indexJson, tagPresets }: TagsFilterProps) => {
  const filtersById = useMemo<{ [id: string]: Filter }>(() => {
    const userTagsCounts = Object.values(indexJson.entries).reduce<{ [key: Tag]: number }>(
      (acc, entry) => {
        entry.tags?.forEach((tag: Tag) => {
          if (!BUILT_IN_TAGS.has(tag)) {
            acc[tag] = (acc[tag] || 0) + 1;
          }
        });
        return acc;
      },
      {}
    );

    const userFilters = Object.fromEntries(
      Object.entries(userTagsCounts).map(([tag, count]) => {
        const filterFn = (entry: API_PreparedIndexEntry, excluded?: boolean) =>
          excluded ? !entry.tags?.includes(tag) : !!entry.tags?.includes(tag);
        return [tag, { id: tag, type: 'tag', title: tag, count, filterFn }];
      })
    );

    const withCount = (filterFn: FilterFunction) => ({
      count: Object.values(indexJson.entries).filter((entry) => filterFn(entry)).length,
      filterFn,
    });

    const builtInFilters = {
      _docs: {
        id: '_docs',
        type: 'built-in',
        title: 'Documentation',
        icon: <DocumentIcon color={color.gold} />,
        ...withCount((entry: API_PreparedIndexEntry, excluded?: boolean) =>
          excluded ? entry.type !== 'docs' : entry.type === 'docs'
        ),
      },
      _play: {
        id: '_play',
        type: 'built-in',
        title: 'Play',
        icon: <PlayHollowIcon color={color.seafoam} />,
        ...withCount((entry: API_PreparedIndexEntry, excluded?: boolean) =>
          excluded
            ? entry.type !== 'story' || !entry.tags?.includes(Tag.PLAY_FN)
            : entry.type === 'story' && !!entry.tags?.includes(Tag.PLAY_FN)
        ),
      },
      _test: {
        id: '_test',
        type: 'built-in',
        title: 'Testing',
        icon: <BeakerIcon color={color.green} />,
        ...withCount((entry: API_PreparedIndexEntry, excluded?: boolean) =>
          excluded
            ? entry.type !== 'story' || entry.subtype !== 'test'
            : entry.type === 'story' && entry.subtype === 'test'
        ),
      },
    };

    return { ...userFilters, ...builtInFilters };
  }, [indexJson.entries]);

  const { defaultIncluded, defaultExcluded } = useMemo(() => {
    return Object.entries(tagPresets).reduce(
      (acc, [tag, { defaultFilterSelection }]) => {
        if (defaultFilterSelection === 'include') {
          acc.defaultIncluded.add(tag);
        } else if (defaultFilterSelection === 'exclude') {
          acc.defaultExcluded.add(tag);
        }
        return acc;
      },
      { defaultIncluded: new Set<string>(), defaultExcluded: new Set<string>() }
    );
  }, [tagPresets]);

  const [includedFilters, setIncludedFilters] = useState(new Set(defaultIncluded));
  const [excludedFilters, setExcludedFilters] = useState(new Set(defaultExcluded));
  const [expanded, setExpanded] = useState(false);
  const tagsActive = includedFilters.size > 0 || excludedFilters.size > 0;

  const resetFilters = useCallback(() => {
    setIncludedFilters(new Set(defaultIncluded));
    setExcludedFilters(new Set(defaultExcluded));
  }, [defaultIncluded, defaultExcluded]);

  useEffect(resetFilters, [resetFilters]);

  useEffect(() => {
    api.experimental_setFilter(TAGS_FILTER, (item) => {
      const included = Object.values(
        groupByType(Array.from(includedFilters).map((id) => filtersById[id]))
      );
      const excluded = Object.values(
        groupByType(Array.from(excludedFilters).map((id) => filtersById[id]))
      );

      return (
        (!included.length ||
          included.every((group) => group.some(({ filterFn }) => filterFn(item, false)))) &&
        (!excluded.length ||
          excluded.every((group) => group.every(({ filterFn }) => filterFn(item, true))))
      );
    });
  }, [api, includedFilters, excludedFilters, filtersById]);

  const toggleFilter = useCallback(
    (id: string, selected: boolean, excluded?: boolean) => {
      if (excluded === true) {
        setExcludedFilters(add(excludedFilters, id));
        setIncludedFilters(remove(includedFilters, id));
      } else if (excluded === false) {
        setIncludedFilters(add(includedFilters, id));
        setExcludedFilters(remove(excludedFilters, id));
      } else if (selected) {
        setIncludedFilters(add(includedFilters, id));
        setExcludedFilters(remove(excludedFilters, id));
      } else {
        setIncludedFilters(remove(includedFilters, id));
        setExcludedFilters(remove(excludedFilters, id));
      }
    },
    [includedFilters, excludedFilters]
  );

  const setAllFilters = useCallback(
    (selected: boolean) => {
      if (selected) {
        setIncludedFilters(new Set(Object.keys(filtersById)));
      } else {
        setIncludedFilters(new Set());
      }
      setExcludedFilters(new Set());
    },
    [filtersById]
  );

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
      popover={() => (
        <TagsFilterPanel
          api={api}
          filtersById={filtersById}
          includedFilters={includedFilters}
          excludedFilters={excludedFilters}
          toggleFilter={toggleFilter}
          setAllFilters={setAllFilters}
          resetFilters={resetFilters}
          isDefaultSelection={
            equal(includedFilters, defaultIncluded) && equal(excludedFilters, defaultExcluded)
          }
          hasDefaultSelection={defaultIncluded.size > 0 || defaultExcluded.size > 0}
        />
      )}
    >
      <StyledButton
        key="tags"
        ariaLabel="Tag filters"
        ariaDescription="Filter the items shown in a sidebar based on the tags applied to them."
        aria-haspopup="dialog"
        variant="ghost"
        padding="small"
        isHighlighted={tagsActive}
        onClick={handleToggleExpand}
      >
        <FilterIcon />
        {includedFilters.size + excludedFilters.size > 0 && <TagSelected />}
      </StyledButton>
    </PopoverProvider>
  );
};
