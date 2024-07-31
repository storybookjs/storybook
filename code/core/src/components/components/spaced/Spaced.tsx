import React from 'react';
import { styled, ignoreSsrWarning } from '@storybook/core/theming';

const toNumber = (input: any) => (typeof input === 'number' ? input : Number(input));

export interface ContainerProps {
  col?: number;
  row?: number;
  outer?: number;
}

const Container = styled.div<ContainerProps>(
  ({ theme, col, row = 1 }) =>
    col
      ? {
          display: 'inline-block',
          verticalAlign: 'inherit',
          '& > *': {
            marginLeft: col * theme.layoutMargin,
            verticalAlign: 'inherit',
          },
          [`& > *:first-child${ignoreSsrWarning}`]: {
            marginLeft: 0,
          },
        }
      : {
          '& > *': {
            marginTop: row * theme.layoutMargin,
          },
          [`& > *:first-child${ignoreSsrWarning}`]: {
            marginTop: 0,
          },
        },
  ({ theme, outer, col, row }) => {
    switch (true) {
      case !!(outer && col): {
        return {
          marginLeft: outer * theme.layoutMargin,
          marginRight: outer * theme.layoutMargin,
        };
      }
      case !!(outer && row): {
        return {
          marginTop: outer * theme.layoutMargin,
          marginBottom: outer * theme.layoutMargin,
        };
      }
      default: {
        return {};
      }
    }
  }
);

export interface SpacedProps {
  children?: React.ReactNode;
  col?: number;
  row?: number;
  outer?: number | boolean;
}

export const Spaced = ({ col, row, outer, children, ...rest }: SpacedProps) => {
  const outerAmount = toNumber(typeof outer === 'number' || !outer ? outer : col || row);

  return (
    <Container col={col} row={row} outer={outerAmount} {...rest}>
      {children}
    </Container>
  );
};
