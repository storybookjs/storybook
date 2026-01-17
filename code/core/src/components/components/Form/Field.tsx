import React, { type ReactNode } from 'react';

import { styled } from 'storybook/theming';

const Wrapper = styled.label({
  display: 'flex',
  borderBottom: `1px solid var(--sb-appBorderColor)`,
  margin: '0 15px',
  padding: '8px 0',

  '&:last-child': {
    marginBottom: '3rem',
  },
});

const Label = styled.span({
  minWidth: 100,
  fontWeight: 'var(--sb-typography-weight-bold)',
  marginRight: 15,
  display: 'flex',
  justifyContent: 'flex-start',
  alignItems: 'center',
  lineHeight: '16px',
});

export interface FieldProps {
  children?: ReactNode;
  label?: ReactNode;
}

export const Field = ({ label, children, ...props }: FieldProps) => (
  <Wrapper {...props}>
    {label ? (
      <Label>
        <span>{label}</span>
      </Label>
    ) : null}
    {children}
  </Wrapper>
);
