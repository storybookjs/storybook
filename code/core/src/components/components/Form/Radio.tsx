import React from 'react';

import { color, styled } from 'storybook/theming';

const Input = styled.input(({ theme }) => ({
  appearance: 'none',
  backgroundColor: theme.input.background,
  border: `1px solid ${theme.base === 'dark' ? 'hsl(0 0 100 / 0.4)' : 'hsl(0 0 0 / 0.44)'}`,
  borderRadius: 8,
  display: 'grid',
  flexShrink: 0,
  height: 16,
  margin: -1,
  placeContent: 'center',
  transition: 'background-color 0.1s',
  width: 16,

  '&:enabled': {
    cursor: 'pointer',
  },
  '&:disabled': {
    backgroundColor: 'transparent',
    borderColor: theme.input.border,
  },
  '&:disabled:checked': {
    backgroundColor: theme.base === 'dark' ? color.dark : theme.color.mediumdark,
    borderColor: theme.base === 'dark' ? color.dark : theme.color.mediumdark,
  },
  '&:checked': {
    backgroundColor: color.secondary,
    borderColor: color.secondary,
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
