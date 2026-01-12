import React, { Children } from 'react';

import { styled } from 'storybook/theming';

const Title = styled.div({
  fontWeight: 'var(--sb-typography-weight-bold)',
});

const Desc = styled.div();

const Message = styled.div({
  padding: 30,
  textAlign: 'center',
  color: 'var(--sb-color-defaultText)',
  fontSize: 'calc(var(--sb-typography-size-s2) - 1px)',
});

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
