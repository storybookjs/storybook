import React from 'react';
import { styled } from '@storybook/core/theming';

const Wrapper = styled.div(({ theme }) => ({
  height: '100%',
  display: 'flex',
  padding: 30,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: 15,
  background: theme.background.content,
}));

const Content = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  maxWidth: 415,
});

const Title = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s2 - 1,
  textAlign: 'center',
  color: theme.textColor,
}));

const Description = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.regular,
  fontSize: theme.typography.size.s2 - 1,
  textAlign: 'center',
  color: theme.textMutedColor,
}));

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
      {footer}
    </Wrapper>
  );
};
