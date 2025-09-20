import React from 'react';

import { color, styled } from 'storybook/theming';

const Input = styled.input({
  appearance: 'none',
  display: 'grid',
  placeContent: 'center',
  width: 14,
  height: 14,
  flexShrink: 0,
  margin: 0,
  border: `1px solid ${color.border}`,
  borderRadius: 2,
  backgroundColor: 'white',
  transition: 'background-color 0.1s',

  '&:enabled': {
    cursor: 'pointer',
  },
  '&:disabled': {
    backgroundColor: color.medium,
  },
  '&:disabled:checked, &:disabled:indeterminate': {
    backgroundColor: color.mediumdark,
  },
  '&:checked, &:indeterminate': {
    backgroundColor: color.secondary,
  },
  '&:checked::before': {
    content: '""',
    width: 14,
    height: 14,
    background: `no-repeat center url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14'%3E%3Cpath fill='none' stroke='%23fff' stroke-width='2' d='m3 7 2.5 2.5L11 4'/%3E%3C/svg%3E")`,
  },
  '&:indeterminate::before': {
    content: '""',
    width: 8,
    height: 2,
    background: 'white',
  },
  '&:enabled:focus-visible': {
    outline: `1px solid ${color.secondary}`,
    outlineOffset: 1,
  },
});

export const Checkbox = (props: React.InputHTMLAttributes<HTMLInputElement>) => {
  return <Input {...props} type="checkbox" />;
};
