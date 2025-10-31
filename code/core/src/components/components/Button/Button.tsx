import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import React, { forwardRef, useEffect, useState } from 'react';

import { Slot } from '@radix-ui/react-slot';
import { darken, lighten, rgba, transparentize } from 'polished';
import { isPropValid, styled } from 'storybook/theming';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  as?: 'a' | 'button' | 'div' | 'label' | typeof Slot;
  asChild?: boolean;
  size?: 'small' | 'medium';
  padding?: 'small' | 'medium' | 'none';
  variant?: 'outline' | 'solid' | 'ghost';
  disabled?: boolean;
  readOnly?: boolean;
  active?: boolean;
  animation?: 'none' | 'rotate360' | 'glow' | 'jiggle';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      as = 'button',
      asChild = false,
      animation = 'none',
      size = 'small',
      variant = 'outline',
      padding = 'medium',
      disabled = false,
      readOnly = false,
      active = false,
      onClick,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : as;

    const [isAnimating, setIsAnimating] = useState(false);

    const handleClick: ButtonProps['onClick'] = (event) => {
      if (onClick) {
        onClick(event);
      }

      if (animation === 'none') {
        return;
      }
      setIsAnimating(true);
    };

    useEffect(() => {
      const timer = setTimeout(() => {
        if (isAnimating) {
          setIsAnimating(false);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }, [isAnimating]);

    return (
      <StyledButton
        as={Comp}
        ref={ref}
        variant={variant}
        size={size}
        padding={padding}
        disabled={disabled}
        readOnly={readOnly}
        active={active}
        animating={isAnimating}
        animation={animation}
        onClick={handleClick}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

const StyledButton = styled('button', {
  shouldForwardProp: (prop) => isPropValid(prop),
})<
  ButtonProps & {
    animating: boolean;
    animation: ButtonProps['animation'];
  }
>(
  ({
    theme,
    variant,
    size,
    disabled,
    readOnly,
    active,
    animating,
    animation = 'none',
    padding,
  }) => ({
    border: 0,
    cursor: readOnly ? 'inherit' : disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    gap: '6px',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: (() => {
      if (padding === 'none') {
        return 0;
      }
      if (padding === 'small' && size === 'small') {
        return '0 7px';
      }
      if (padding === 'small' && size === 'medium') {
        return '0 9px';
      }
      if (size === 'small') {
        return '0 10px';
      }
      if (size === 'medium') {
        return '0 12px';
      }
      return 0;
    })(),
    height: size === 'small' ? '28px' : '32px',
    position: 'relative',
    textAlign: 'center',
    textDecoration: 'none',
    transitionProperty: 'background, box-shadow',
    transitionDuration: '150ms',
    transitionTimingFunction: 'ease-out',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    opacity: disabled && !readOnly ? 0.5 : 1,
    margin: 0,
    fontSize: `${theme.typography.size.s1}px`,
    fontWeight: theme.typography.weight.bold,
    lineHeight: '1',
    background: (() => {
      if (variant === 'solid') {
        return theme.color.secondary;
      }

      if (variant === 'outline') {
        return theme.button.background;
      }

      if (variant === 'ghost' && active) {
        return theme.background.hoverable;
      }
      return 'transparent';
    })(),
    ...(variant === 'ghost'
      ? {
          // This is a hack to apply bar styles to the button as soon as it is part of a bar
          // It is a temporary solution until we have implemented Theming 2.0.
          '.sb-bar &': {
            background: (() => {
              if (active) {
                return transparentize(0.9, theme.barTextColor);
              }
              return 'transparent';
            })(),
            color: (() => {
              if (active) {
                return theme.barSelectedColor;
              }
              return theme.barTextColor;
            })(),
            ...(!readOnly && {
              '&:hover': {
                color: theme.barHoverColor,
                background: transparentize(0.86, theme.barHoverColor),
              },

              '&:active': {
                color: theme.barSelectedColor,
                background: transparentize(0.9, theme.barSelectedColor),
              },

              '&:focus': {
                boxShadow: `${rgba(theme.barHoverColor, 1)} 0 0 0 1px inset`,
                outline: 'none',
              },
            }),
          },
        }
      : {}),
    color: (() => {
      if (variant === 'solid') {
        return theme.color.lightest;
      }

      if (variant === 'outline') {
        return theme.input.color;
      }

      if (variant === 'ghost' && active) {
        return theme.color.secondary;
      }

      if (variant === 'ghost') {
        return theme.color.mediumdark;
      }
      return theme.input.color;
    })(),
    boxShadow: variant === 'outline' ? `${theme.button.border} 0 0 0 1px inset` : 'none',
    borderRadius: theme.input.borderRadius,
    // Making sure that the button never shrinks below its minimum size
    flexShrink: 0,

    ...(!readOnly && {
      '&:hover': {
        color: variant === 'ghost' ? theme.color.secondary : undefined,
        background: (() => {
          let bgColor = theme.color.secondary;

          if (variant === 'solid') {
            bgColor = theme.color.secondary;
          }

          if (variant === 'outline') {
            bgColor = theme.button.background;
          }

          if (variant === 'ghost') {
            return transparentize(0.86, theme.color.secondary);
          }
          return theme.base === 'light' ? darken(0.02, bgColor) : lighten(0.03, bgColor);
        })(),
      },

      '&:active': {
        color: variant === 'ghost' ? theme.color.secondary : undefined,
        background: (() => {
          let bgColor = theme.color.secondary;

          if (variant === 'solid') {
            bgColor = theme.color.secondary;
          }

          if (variant === 'outline') {
            bgColor = theme.button.background;
          }

          if (variant === 'ghost') {
            return theme.background.hoverable;
          }
          return theme.base === 'light' ? darken(0.02, bgColor) : lighten(0.03, bgColor);
        })(),
      },

      '&:focus': {
        boxShadow: `${rgba(theme.color.secondary, 1)} 0 0 0 1px inset`,
        outline: 'none',
      },
    }),

    '> svg': {
      animation:
        animating && animation !== 'none' ? `${theme.animation[animation]} 1000ms ease-out` : '',
    },
  })
);
