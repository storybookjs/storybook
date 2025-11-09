import React from 'react';

import { color, styled } from 'storybook/theming';

const Input = styled.input({
  appearance: 'none',
  display: 'grid',
  placeContent: 'center',
  width: 16,
  height: 16,
  flexShrink: 0,
  margin: -1,
  border: `1px solid ${color.border}`,
  borderRadius: 8,
  backgroundColor: 'white',
  transition: 'background-color 0.1s',

  '&:enabled': {
    cursor: 'pointer',
  },
  '&:disabled': {
    backgroundColor: color.medium,
  },
  '&:disabled:checked': {
    backgroundColor: color.mediumdark,
  },
  '&:checked': {
    backgroundColor: color.secondary,
    boxShadow: `inset 0 0 0 2px white`,
  },
  '&:enabled:focus-visible': {
    outline: `1px solid ${color.secondary}`,
    outlineOffset: 1,
  },
});

export const Radio = (props: React.InputHTMLAttributes<HTMLInputElement>) => {
  return <Input {...props} type="radio" />;
};
