import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { color, styled } from 'storybook/theming';

const Input = styled.input(({ theme }) => ({
  appearance: 'none',
  backgroundColor: theme.input.background,
  border: `1px solid ${theme.base === 'dark' ? 'hsl(0 0 100 / 0.4)' : 'hsl(0 0 0 / 0.44)'}`,
  borderRadius: 2,
  display: 'grid',
  flexShrink: 0,
  height: 14,
  margin: 0,
  placeContent: 'center',
  transition: 'background-color 0.1s',
  width: 14,

  '&:enabled': {
    cursor: 'pointer',
  },
  '&:disabled': {
    backgroundColor: 'transparent',
    borderColor: theme.input.border,
  },
  '&:disabled:checked, &:disabled:indeterminate': {
    backgroundColor: theme.base === 'dark' ? color.dark : theme.color.mediumdark,
  },
  '&:checked, &:indeterminate': {
    border: 'none',
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
    outline: `2px solid ${theme.color.secondary}`,
    outlineOffset: 2,
  },
}));

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Render the mixed state, for a value that is neither on nor off. Browsers show it instead of the
   * `checked` state, and expose the checkbox as `mixed` to assistive technology.
   */
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { indeterminate = false, ...props },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // `indeterminate` is a DOM property without an HTML attribute, so React cannot set it for us.
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return <Input {...props} ref={inputRef} type="checkbox" />;
});
