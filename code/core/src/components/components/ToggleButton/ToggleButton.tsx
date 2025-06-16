import React, { forwardRef } from 'react';

import { transparentize } from 'polished';
import { styled } from 'storybook/theming';

import type { ButtonProps } from '../Button/Button';
import { Button } from '../Button/Button';

export interface ToggleButtonProps extends ButtonProps {
  /** Whether the ToggleButton is currently pressed or not. */
  pressed: boolean;
}

// TODO: discuss ideal aria attrs based on https://adrianroselli.com/2021/10/Toggle-role-support.html.

export const ToggleButton = forwardRef<HTMLButtonElement, ToggleButtonProps>(
  ({ pressed, ...props }, ref) => {
    return (
      <StyledToggle role="switch" aria-checked={pressed} ref={ref} pressed={pressed} {...props} />
    );
  }
);

ToggleButton.displayName = 'ToggleButton';

const StyledToggle = styled(Button)<ToggleButtonProps>(({ theme, variant, pressed }) => ({
  ...(pressed
    ? {
        background: theme.background.hoverable,
        color: theme.color.secondary,
        boxShadow: 'none',
        ...(variant === 'ghost'
          ? {
              background: theme.background.hoverable,
              color: theme.color.secondary,

              // This is a hack to apply bar styles to the button as soon as it is part of a bar
              // It is a temporary solution until we have implemented Theming 2.0.
              '.sb-bar &': {
                background: transparentize(0.9, theme.barTextColor),
                color: theme.barSelectedColor,
              },
            }
          : {}),
      }
    : {}),
}));
