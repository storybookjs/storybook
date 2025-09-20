import type { ComponentProps } from 'react';
import React, { forwardRef } from 'react';

import { darken, lighten, transparentize } from 'polished';
import { styled } from 'storybook/theming';

export interface ButtonProps extends ComponentProps<'button'> {
  children: string;
  onClick?: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'white';
}

const StyledButton = styled.button<{ variant: ButtonProps['variant'] }>(({ theme, variant }) => ({
  all: 'unset',
  boxSizing: 'border-box',
  border: 0,
  borderRadius: '4px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 0.75rem',
  background: (() => {
    if (variant === 'secondary') {
      return theme.button.background;
    }

    if (variant === 'outline') {
      return 'transparent';
    }

    if (variant === 'white') {
      return theme.color.lightest;
    }
    return theme.base === 'light' ? theme.color.secondary : darken(0.18, theme.color.secondary);
  })(),
  color: (() => {
    if (variant === 'secondary' || variant === 'outline') {
      return theme.color.defaultText;
    }

    if (variant === 'white') {
      return theme.base === 'light' ? theme.color.secondary : darken(0.18, theme.color.secondary);
    }

    return theme.color.lightest;
  })(),
  boxShadow: (() => {
    if (variant === 'secondary') {
      return `${theme.button.border} 0 0 0 1px inset`;
    }

    if (variant === 'outline') {
      return `${theme.button.border} 0 0 0 1px inset`;
    }
    return 'none';
  })(),
  height: '32px',
  fontSize: '0.8125rem',
  fontWeight: '700',
  fontFamily: theme.typography.fonts.base,
  transition: 'background-color, box-shadow, color, opacity',
  transitionDuration: '0.16s',
  transitionTimingFunction: 'ease-in-out',
  textDecoration: 'none',

  '&:hover, &:focus': {
    background: (() => {
      if (variant === 'secondary' || variant === 'outline') {
        return transparentize(0.93, theme.color.secondary);
      }

      if (variant === 'white') {
        return transparentize(0.1, theme.color.lightest);
      }

      return theme.base === 'light'
        ? lighten(0.1, theme.color.secondary)
        : darken(0.3, theme.color.secondary);
    })(),
    color: (() => {
      if (variant === 'secondary' || variant === 'outline') {
        return theme.barSelectedColor;
      }

      if (variant === 'white') {
        return theme.base === 'light'
          ? lighten(0.1, theme.color.secondary)
          : darken(0.3, theme.color.secondary);
      }
      return theme.color.lightest;
    })(),
    boxShadow: (() => {
      if (variant === 'secondary' || variant === 'outline' || variant === 'white') {
        return `inset 0 0 0 1px ${theme.barSelectedColor}`;
      }

      return 'none';
    })(),
  },

  '&:focus-visible': {
    outline: `solid ${theme.color.secondary}`,
    outlineOffset: '2px',
    outlineWidth: '2px',
  },
}));

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, onClick, variant = 'primary', ...rest },
  ref
) {
  return (
    <StyledButton ref={ref} onClick={onClick} variant={variant} {...rest}>
      {children}
    </StyledButton>
  );
});
