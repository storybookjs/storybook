import type { ComponentProps } from 'react';
import React, { forwardRef } from 'react';

import { Button } from 'storybook/internal/components';
import type { StatusValue } from 'storybook/internal/types';

import type { Theme } from '@emotion/react';
import { darken, lighten, transparentize } from 'polished';
import { styled } from 'storybook/theming';

const withStatusColor = ({ theme, status }: { theme: Theme; status: StatusValue }) => {
  const defaultColor =
    theme.base === 'light'
      ? transparentize(0.3, theme.color.defaultText)
      : transparentize(0.6, theme.color.defaultText);

  return {
    color: {
      'status-value:pending': defaultColor,
      'status-value:success': theme.color.positive,
      'status-value:error': theme.color.negative,
      'status-value:warning': theme.color.warning,
      'status-value:unknown': defaultColor,
    }[status],
  };
};

export const StatusLabel = styled.div<{ status: StatusValue }>(withStatusColor, {
  margin: 3,
});

export type StatusButtonProps = ComponentProps<typeof StyledButton>;

const StyledButton = styled(Button)<{
  height?: number;
  width?: number;
  status: StatusValue;
  selectedItem?: boolean;
}>(
  withStatusColor,
  ({ theme, height, width }) => ({
    transition: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: width || 28,
    height: height || 28,

    '&:hover': {
      color: theme.color.secondary,
      background:
        theme.base === 'dark'
          ? darken(0.3, theme.color.secondary)
          : lighten(0.4, theme.color.secondary),
    },

    '[data-selected="true"] &': {
      background:
        theme.base === 'dark' ? darken(0.18, theme.color.secondary) : theme.color.secondary,
      boxShadow: `0 0 5px 5px ${theme.base === 'dark' ? darken(0.18, theme.color.secondary) : theme.color.secondary}`,

      '&:hover': {
        background:
          theme.base === 'dark' ? darken(0.1, theme.color.secondary) : theme.color.secondary,
      },
    },

    '&:focus': {
      color: theme.color.secondary,
      borderColor: theme.color.secondary,
      outlineOffset: -2,

      '&:not(:focus-visible)': {
        borderColor: 'transparent',
      },
    },
  }),
  ({ theme, selectedItem }) =>
    selectedItem && {
      '&:hover': {
        boxShadow: `inset 0 0 0 2px ${theme.color.secondary}`,
        background: 'rgba(255, 255, 255, 0.2)',
      },
    }
);

export const StatusButton = forwardRef<HTMLButtonElement, StatusButtonProps>((props, ref) => {
  return <StyledButton variant="ghost" padding="small" {...props} ref={ref} />;
});
StatusButton.displayName = 'StatusButton';
