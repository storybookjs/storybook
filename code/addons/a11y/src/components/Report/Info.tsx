import type { FC } from 'react';
import React from 'react';

import { styled } from 'storybook/internal/theming';
import type { Result } from 'axe-core';

const Wrapper = styled.div({
  padding: 12,
  marginBottom: 10,
});
const Description = styled.p({
  margin: '0 0 12px',
});
const Link = styled.a({
  marginTop: 12,
  textDecoration: 'underline',
  color: 'inherit',
  display: 'block',
});

interface InfoProps {
  item: Result;
}

export const Info: FC<InfoProps> = ({ item }) => {
  return (
    <Wrapper>
      <Description>{item.description}</Description>
      <Link href={item.helpUrl} target="_blank">
        More info...
      </Link>
    </Wrapper>
  );
};
