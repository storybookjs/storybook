import React from 'react';

import { styled } from 'storybook/theming';

const Input = styled.input(({ theme }) => ({
  appearance: 'none',
  backgroundColor: 'var(--sb-input-background)',
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
    borderColor: 'var(--sb-input-border)',
  },
  '&:disabled:checked': {
    backgroundColor: theme.base === 'dark' ? 'var(--sb-color-dark)' : 'var(--sb-color-mediumdark)',
    borderColor: theme.base === 'dark' ? 'var(--sb-color-dark)' : 'var(--sb-color-mediumdark)',
  },
  '&:checked': {
    backgroundColor: 'var(--sb-color-secondary)',
    borderColor: 'var(--sb-color-secondary)',
    boxShadow: `inset 0 0 0 2px var(--sb-input-background)`,
  },
  '&:enabled:focus-visible': {
    outline: `2px solid var(--sb-color-secondary)`,
    outlineOffset: 2,
  },
}));

export const Radio = (props: React.InputHTMLAttributes<HTMLInputElement>) => {
  return <Input {...props} type="radio" />;
};
