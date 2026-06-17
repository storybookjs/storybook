import type { ComponentProps } from 'react';
import React, { forwardRef } from 'react';

import { Button } from 'storybook/internal/components';

import { darken, lighten } from 'polished';
import { styled } from 'storybook/theming';

export type ContextMenuButtonProps = ComponentProps<typeof StyledButton>;

const StyledButton = styled(Button)<{
  selectedItem?: boolean;
}>(
  ({ theme }) => ({
    transition: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,

    // position: 'absolute',
    // right: 0,
    // zIndex: 1,

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

    '&:focus-visible': {
      outlineOffset: -2,
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

export const ContextMenuButton = forwardRef<HTMLButtonElement, ContextMenuButtonProps>(
  (props, ref) => {
    return <StyledButton variant="ghost" padding="small" {...props} ref={ref} />;
  }
);
ContextMenuButton.displayName = 'ContextMenuButton';
