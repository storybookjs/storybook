import React, { Children } from 'react';

import { styled } from '@storybook/core/theming';

const Title = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
}));

const Desc = styled.div();

const Message = styled.div(({ theme }) => ({
  padding: 30,
  textAlign: 'center',
  color: theme.color.defaultText,
  fontSize: theme.typography.size.s2 - 1,
}));

export interface PlaceholderProps {
  children?: React.ReactNode;
}

export const Placeholder = ({ children, ...props }: PlaceholderProps) => {
  const [title, desc] = Children.toArray(children);
  return (
    <Message {...props}>
      <Title>{title}</Title>
      {desc && <Desc>{desc}</Desc>}
    </Message>
  );
};
