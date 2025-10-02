import React from 'react';

import { color, styled } from 'storybook/theming';

const Input = styled.input(({ theme }) => ({
  appearance: 'none',
  display: 'grid',
  placeContent: 'center',
  width: 16,
  height: 16,
  flexShrink: 0,
  margin: -1,
  border: `1px solid ${theme.input.border}`,
  borderRadius: 8,
  backgroundColor: theme.input.background,
  transition: 'background-color 0.1s',

  '&:enabled': {
    cursor: 'pointer',
  },
  '&:disabled': {
    backgroundColor: theme.base === 'light' ? color.light : 'transparent',
  },
  '&:disabled:checked': {
    backgroundColor: theme.base === 'light' ? color.light : theme.color.mediumdark,
  },
  '&:checked': {
    backgroundColor: color.secondary,
    boxShadow: `inset 0 0 0 2px ${theme.input.background}`,
  },
  '&:enabled:focus-visible': {
    outline: `2px solid ${theme.color.secondary}`,
    outlineOffset: 2,
  },
}));

export const Radio = (props: React.InputHTMLAttributes<HTMLInputElement>) => {
  return <Input {...props} type="radio" />;
};
