import type { ChangeEvent } from 'react';
import React, { useState } from 'react';
import { transparentize } from 'polished';
import { styled } from '@storybook/theming';
import { CollapseIcon } from './components/CollapseIcon';
import type { Tag } from '@storybook/types';

const BUILT_IN_TAGS = new Set([
  'dev',
  'autodocs',
  'test',
  'attached-mdx',
  'unattached-mdx',
  'play-fn',
]);

const CollapseButton = styled.button(({ theme }) => ({
  all: 'unset',
  display: 'flex',
  padding: '0px 8px',
  borderRadius: 4,
  transition: 'color 150ms, box-shadow 150ms',
  gap: 6,
  alignItems: 'center',
  cursor: 'pointer',
  height: 28,

  '&:hover, &:focus': {
    outline: 'none',
    background: transparentize(0.93, theme.color.secondary),
  },
}));

const Text = styled.span({
  '[aria-readonly=true] &': {
    opacity: 0.5,
  },
});

const Label = styled.label({
  lineHeight: '20px',
  alignItems: 'center',
  marginBottom: 8,

  '&:last-child': {
    marginBottom: 0,
  },

  input: {
    margin: 0,
    marginRight: 6,
  },
});

interface TagsFilterPanelProps {
  allTags: Tag[];
  selectedTags: Tag[];
  exclude: boolean;
  toggleTag: (tag: Tag) => void;
  toggleExclude: () => void;
}

interface TagsListProps {
  tags: Tag[];
  selectedTags: Tag[];
  toggleTag: (tag: Tag) => void;
}

const TagsList = ({ tags, selectedTags, toggleTag }: TagsListProps) => {
  return tags.map((tag) => {
    const checked = selectedTags.includes(tag);
    const id = `tag-${tag}`;
    return (
      <Label key={id} htmlFor={id}>
        <input
          type="checkbox"
          id={id}
          name={id}
          value={tag}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            toggleTag(e.target.value);
          }}
          checked={checked}
        />
        <Text>{tag}</Text>
      </Label>
    );
  });
};

const Wrapper = styled.div({
  padding: 10,
  label: {
    display: 'flex',
  },
});

export const TagsFilterPanel = ({
  allTags,
  selectedTags,
  exclude,
  toggleTag,
  toggleExclude,
}: TagsFilterPanelProps) => {
  const userTags = allTags.filter((tag) => !BUILT_IN_TAGS.has(tag)).toSorted();
  const builtInTags = allTags.filter((tag) => BUILT_IN_TAGS.has(tag)).toSorted();
  const [builtinsExpanded, setBuiltinsExpanded] = useState(
    selectedTags.some((tag) => BUILT_IN_TAGS.has(tag))
  );

  return (
    <div>
      {userTags.length === 0 ? (
        'No tags defined'
      ) : (
        <Wrapper>
          Tags <span onClick={toggleExclude}>{exclude ? 'does not contain' : 'contains'}</span>
          <TagsList tags={userTags} selectedTags={selectedTags} toggleTag={toggleTag} />
        </Wrapper>
      )}
      {builtInTags.length > 0 && (
        <>
          <CollapseButton
            type="button"
            data-action="collapse-root"
            onClick={(event) => {
              event.preventDefault();
              setBuiltinsExpanded(!builtinsExpanded);
            }}
            aria-expanded={builtinsExpanded}
          >
            <CollapseIcon isExpanded={builtinsExpanded} />
            Built-in tags
          </CollapseButton>
          {builtinsExpanded ? (
            <Wrapper>
              <TagsList tags={builtInTags} selectedTags={selectedTags} toggleTag={toggleTag} />
            </Wrapper>
          ) : null}
        </>
      )}
    </div>
  );
};
