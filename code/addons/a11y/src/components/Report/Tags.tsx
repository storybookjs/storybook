import type { FC } from 'react';
import React from 'react';

import { styled } from 'storybook/internal/theming';
import type { TagValue } from 'axe-core';

const Wrapper = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  margin: '12px 0',
});

const Item = styled.div(({ theme }) => ({
  margin: '0 6px',
  padding: 5,
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius,
}));

interface TagsProps {
  tags: TagValue[];
}

export const Tags: FC<TagsProps> = ({ tags }) => {
  return (
    <Wrapper>
      {tags.map((tag) => (
        <Item key={tag}>{tag}</Item>
      ))}
    </Wrapper>
  );
};
