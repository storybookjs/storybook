import React, { forwardRef } from 'react';

import { darken, transparentize } from 'polished';
import { styled } from 'storybook/theming';

import { Button, type ButtonProps } from '../Button/Button';

export interface ToggleButtonProps extends ButtonProps {
  /** Whether the ToggleButton is currently pressed or not. */
  pressed: boolean;
}

// In case of reports on screenreader announcements, please check
// https://adrianroselli.com/2021/10/switch-role-support.html.

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
        ...(variant === 'solid'
          ? {
              background:
                theme.base === 'lighten'
                  ? darken(0.1, theme.color.secondary)
                  : darken(0.2, theme.color.secondary),
            }
          : {}),
        ...(variant === 'outline'
          ? {
              background: transparentize(0.94, theme.barSelectedColor),
              boxShadow: `${theme.barSelectedColor} 0 0 0 1px inset`,
              color: theme.barSelectedColor,
            }
          : {}),
        ...(variant === 'ghost'
          ? {
              background: transparentize(0.93, theme.barSelectedColor),
              color:
                theme.base === 'light' ? darken(0.1, theme.color.secondary) : theme.color.secondary,
            }
          : {}),
      }
    : {}),
}));
