import React, { forwardRef } from 'react';

import { Button } from 'storybook/internal/components';
import type { ButtonProps } from 'storybook/internal/components';

import { darken, transparentize } from 'polished';
import { styled } from 'storybook/theming';

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
              background: darken(0.1, theme.color.secondary),
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
              background: transparentize(0.94, theme.barSelectedColor),
              color: theme.barSelectedColor,
              // This is a hack to apply bar styles to the button as soon as it is part of a bar
              // It is a temporary solution until we have implemented Theming 2.0.
              '.sb-bar &': {
                background: transparentize(0.94, theme.barSelectedColor),

                color: theme.barSelectedColor,
              },
            }
          : {}),
      }
    : {}),
}));
