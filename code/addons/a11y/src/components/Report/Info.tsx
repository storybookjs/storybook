import type { FC } from 'react';
import React from 'react';

import { Link } from 'storybook/internal/components';

import type { Result } from 'axe-core';
import { styled } from 'storybook/theming';

const Wrapper = styled.div({
  display: 'flex',
  flexDirection: 'column',
});

const Description = styled.p({
  margin: 0,
});

interface InfoProps {
  item: Result;
}

export const Info: FC<InfoProps> = ({ item }) => {
  return (
    <Wrapper>
      <Description>
        {item.description.endsWith('.') ? item.description : `${item.description}.`}
      </Description>
      <Link href={item.helpUrl} target="_blank" withArrow>
        Learn how to resolve this violation
      </Link>
    </Wrapper>
  );
};
