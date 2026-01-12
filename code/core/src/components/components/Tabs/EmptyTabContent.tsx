import React from 'react';

import { styled } from 'storybook/theming';

const Wrapper = styled.div({
  height: '100%',
  display: 'flex',
  padding: 30,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: 15,
  background: 'var(--sb-background-content)',
});

const Content = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  maxWidth: 415,
});

const Title = styled.div({
  fontWeight: 'var(--sb-typography-weight-bold)',
  fontSize: 'calc(var(--sb-typography-size-s2) - 1px)',
  textAlign: 'center',
  color: 'var(--sb-color-defaultText)',
});

const Footer = styled.div({
  fontSize: 'calc(var(--sb-typography-size-s2) - 1px)',
});

const Description = styled.div({
  fontWeight: 'var(--sb-typography-weight-regular)',
  fontSize: 'calc(var(--sb-typography-size-s2) - 1px)',
  textAlign: 'center',
  color: 'var(--sb-textMutedColor)',
});

interface Props {
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
}

export const EmptyTabContent = ({ title, description, footer }: Props) => {
  return (
    <Wrapper>
      <Content>
        <Title>{title}</Title>
        {description && <Description>{description}</Description>}
      </Content>
      {footer && <Footer>{footer}</Footer>}
    </Wrapper>
  );
};
