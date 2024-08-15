import type { ButtonHTMLAttributes, SyntheticEvent } from 'react';
import React, { forwardRef, useEffect, useState } from 'react';

import { isPropValid, styled } from '@storybook/core/theming';

import { deprecate } from '@storybook/core/client-logger';

import { Slot } from '@radix-ui/react-slot';
import { darken, lighten, rgba, transparentize } from 'polished';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  size?: 'small' | 'medium';
  padding?: 'small' | 'medium';
  variant?: 'outline' | 'solid' | 'ghost';
  onClick?: (event: SyntheticEvent) => void;
  disabled?: boolean;
  active?: boolean;
  animation?: 'none' | 'rotate360' | 'glow' | 'jiggle';

  /** @deprecated Use {@link asChild} instead. This will be removed in Storybook 9.0 */
  isLink?: boolean;
  /** @deprecated Use {@link variant} instead. This will be removed in Storybook 9.0 */
  primary?: boolean;
  /** @deprecated Use {@link variant} instead. This will be removed in Storybook 9.0 */
  secondary?: boolean;
  /** @deprecated Use {@link variant} instead. This will be removed in Storybook 9.0 */
  tertiary?: boolean;
  /** @deprecated Use {@link variant} instead. This will be removed in Storybook 9.0 */
  gray?: boolean;
  /** @deprecated Use {@link variant} instead. This will be removed in Storybook 9.0 */
  inForm?: boolean;
  /** @deprecated Use {@link size} instead. This will be removed in Storybook 9.0 */
  small?: boolean;
  /** @deprecated Use {@link variant} instead. This will be removed in Storybook 9.0 */
  outline?: boolean;
  /** @deprecated Add your icon as a child directly. This will be removed in Storybook 9.0 */
  containsIcon?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      animation = 'none',
      size = 'small',
      variant = 'outline',
      padding = 'medium',
      disabled = false,
      active = false,
      onClick,
      ...props
    },
    ref
  ) => {
    let Comp: 'button' | 'a' | typeof Slot = 'button';

    if (props.isLink) {
      Comp = 'a';
    }

    if (asChild) {
      Comp = Slot;
    }
    let localVariant = variant;
    let localSize = size;

    const [isAnimating, setIsAnimating] = useState(false);

    const handleClick = (event: SyntheticEvent) => {
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

    // Match the old API with the new API.
    // TODO: Remove this after 9.0.
    if (props.primary) {
      localVariant = 'solid';
      localSize = 'medium';
    }

    // Match the old API with the new API.
    // TODO: Remove this after 9.0.
    if (props.secondary || props.tertiary || props.gray || props.outline || props.inForm) {
      localVariant = 'outline';
      localSize = 'medium';
    }

    if (
      props.small ||
      props.isLink ||
      props.primary ||
      props.secondary ||
      props.tertiary ||
      props.gray ||
      props.outline ||
      props.inForm ||
      props.containsIcon
    ) {
      const buttonContent = React.Children.toArray(props.children).filter(
        (e) => typeof e === 'string' && e !== ''
      );

      deprecate(
        `Use of deprecated props in the button ${
          buttonContent.length > 0 ? `"${buttonContent.join(' ')}"` : 'component'
        } detected, see the migration notes at https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#new-ui-and-props-for-button-and-iconbutton-components`
      );
    }

    return (
      <StyledButton
        as={Comp}
        ref={ref}
        variant={localVariant}
        size={localSize}
        padding={padding}
        disabled={disabled}
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
>(({ theme, variant, size, disabled, active, animating, animation = 'none', padding }) => ({
  border: 0,
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'inline-flex',
  gap: '6px',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  padding: (() => {
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
  opacity: disabled ? 0.5 : 1,
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

  '> svg': {
    animation:
      animating && animation !== 'none' ? `${theme.animation[animation]} 1000ms ease-out` : '',
  },
}));
