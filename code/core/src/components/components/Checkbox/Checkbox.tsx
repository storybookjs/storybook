import React from 'react';

import { color, styled } from 'storybook/internal/theming';

const Input = styled.input({
  appearance: 'none',
  display: 'grid',
  placeContent: 'center',
  width: 14,
  height: 14,
  margin: 0,
  border: `1px solid ${color.border}`,
  borderRadius: 2,
  backgroundColor: 'white',
  cursor: 'pointer',

  '&:disabled': {
    backgroundColor: color.border,
    cursor: 'not-allowed',
  },
  '&:disabled:checked, &:disabled:indeterminate': {
    backgroundColor: color.mediumdark,
  },
  '&:checked, &:indeterminate': {
    backgroundColor: color.secondary,
  },
  '&:checked::before': {
    content: `url("data:image/svg+xml,%3Csvg width='10' height='11' viewBox='0 0 10 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 4L3.5 6.5L9 1' stroke='white' stroke-width='2'/%3E%3C/svg%3E")`,
  },
  '&:indeterminate::before': {
    content: '""',
    width: 8,
    height: 2,
    backgroundColor: 'white',
  },
});

export const Checkbox = (props: React.InputHTMLAttributes<HTMLInputElement>) => {
  return <Input {...props} type="checkbox" />;
};
