import React from 'react';
import { styled } from '@storybook/theming';
import { transparentize } from 'polished';

export const Container = styled.span(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.color.dark,
  borderRadius: 3,
  backgroundColor: transparentize(0.95, theme.color.dark),
  paddingInline: '6px',
  paddingBlock: '3px',
  fontSize: 10,
  lineHeight: '1.5',
}));

type KeyboardShortcutProps = {
  label: string;
  className?: string;
};

export function KeyboardShortcut({ label, className }: KeyboardShortcutProps) {
  return (
    <>
      {/**
       * It's hidden to assistive technologies since it's only
       * a visual (decorative) indicator
       */}
      <Container aria-hidden="true" className={className}>
        {label}
      </Container>
    </>
  );
}
