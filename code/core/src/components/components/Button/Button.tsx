import type { ButtonHTMLAttributes, SyntheticEvent } from 'react';
import React, { forwardRef, useEffect, useMemo, useState } from 'react';

import { Slot } from '@radix-ui/react-slot';
import { darken, lighten, rgba, transparentize } from 'polished';
import { isPropValid, styled } from 'storybook/theming';

import { shortcutToAriaKeyshortcuts } from '../../../manager-api';
import type { API_KeyCollection } from '../../../manager-api/modules/shortcuts';
import { useAriaDescription } from '../../../manager/hooks/useAriaDescription';
import {InteractiveTooltipWrapper} from '../tooltip/InteractiveTooltipWrapper';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  size?: 'small' | 'medium';
  padding?: 'small' | 'medium' | 'none';
  variant?: 'outline' | 'solid' | 'ghost';
  onClick?: (event: SyntheticEvent) => void;
  disabled?: boolean;
  animation?: 'none' | 'rotate360' | 'glow' | 'jiggle';

  /**
   * An aria-label for the Button. Use it to provide a concise action label for the button when the
   * Button's content relies on visual context to be understandable.
   */
  ariaLabel?: string;

  /**
   * An optional tooltip to display when the Button is hovered. If the Button has no text content,
   * consider making this the same as the aria-label.
   */
  tooltip?: string;

  /**
   * A more thorough description of what the Button does, provided to non-sighted users through an
   * aria-describedby attribute. Use sparingly for buttons that trigger complex actions.
   */
  description?: string;

  /**
   * An optional keyboard shortcut to enable the button. Will be displayed in the tooltip and passed
   * to aria-keyshortcuts for assistive technologies. The binding of the shortcut and action is
   * managed globally in the manager's shortcuts module.
   */
  shortcut?: API_KeyCollection;
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
      onClick,
      ariaLabel = undefined,
      description = undefined,
      tooltip = undefined,
      shortcut = undefined,
      ...props
    },
    ref
  ) => {
    let Comp: 'button' | 'a' | typeof Slot = 'button';

    if (asChild) {
      Comp = Slot;
    }
    const { ariaDescriptionAttrs, AriaDescription } = useAriaDescription(description);

    const shortcutAttribute = useMemo(() => {
      return shortcut ? shortcutToAriaKeyshortcuts(shortcut) : undefined;
    }, [shortcut]);

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

    return (
      <InteractiveTooltipWrapper shortcut={shortcut} tooltip={tooltip}>
        <StyledButton
          as={Comp}
          ref={ref}
          variant={variant}
          size={size}
          padding={padding}
          disabled={disabled}
          animating={isAnimating}
          animation={animation}
          onClick={handleClick}
          aria-label={ariaLabel}
          aria-keyshortcuts={shortcutAttribute}
          {...ariaDescriptionAttrs}
          {...props}
        />
        <AriaDescription />
      </InteractiveTooltipWrapper>
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
>(({ theme, variant, size, disabled, animating, animation = 'none', padding }) => ({
  border: 0,
  cursor: disabled ? 'not-allowed' : 'pointer',
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

    return 'transparent';
  })(),
  ...(variant === 'ghost'
    ? {
        // This is a hack to apply bar styles to the button as soon as it is part of a bar
        // It is a temporary solution until we have implemented Theming 2.0.
        '.sb-bar &': {
          background: 'transparent',
          color: theme.barTextColor,
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
