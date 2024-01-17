import type { ButtonHTMLAttributes, SyntheticEvent } from 'react';
import React, { forwardRef, useEffect, useState } from 'react';
import { isPropValid, styled } from '@storybook/theming';
import { Slot } from '@radix-ui/react-slot';
import { deprecate } from '@storybook/client-logger';

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
    if (props.isLink) Comp = 'a';
    if (asChild) Comp = Slot;
    let localVariant = variant;
    let localSize = size;

    const [isAnimating, setIsAnimating] = useState(false);

    const handleClick = (event: SyntheticEvent) => {
      if (onClick) onClick(event);
      if (animation === 'none') return;
      setIsAnimating(true);
    };

    useEffect(() => {
      const timer = setTimeout(() => {
        if (isAnimating) setIsAnimating(false);
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
>(({ theme, variant, size, disabled, active, animating, animation, padding }) => ({
  border: 0,
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'inline-flex',
  gap: '6px',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  padding: (() => {
    if (padding === 'small' && size === 'small') return '0 7px';
    if (padding === 'small' && size === 'medium') return '0 9px';
    if (size === 'small') return '0 10px';
    if (size === 'medium') return '0 12px';
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
  fontSize: '12px',
  fontWeight: 700,
  lineHeight: '1',
  background: (() => {
    if (variant === 'solid') return 'var(--sb-button-solidBackground)';
    if (variant === 'outline') return 'var(--sb-button-outlineBackground)';
    if (variant === 'ghost') return 'var(--sb-button-ghostBackground)';
    if (active && variant === 'solid') return 'var(--sb-button-solidActiveBackground)';
    if (active && variant === 'outline') return 'var(--sb-button-outlineActiveBackground)';
    if (active && variant === 'ghost') return 'var(--sb-button-ghostActiveBackground)';
    return 'transparent';
  })(),
  color: (() => {
    if (variant === 'solid') return 'var(--sb-button-solidText)';
    if (variant === 'outline') return 'var(--sb-button-outlineText)';
    if (variant === 'ghost') return 'var(--sb-button-ghostText)';
    if (active && variant === 'solid') return 'var(--sb-button-solidActiveText)';
    if (active && variant === 'outline') return 'var(--sb-button-outlineActiveText)';
    if (active && variant === 'ghost') return 'var(--sb-button-ghostActiveText)';
    return 'var(--sb-button-solidText)';
  })(),
  boxShadow: (() => {
    if (variant === 'solid') return 'var(--sb-button-solidBorder) 0 0 0 1px inset';
    if (variant === 'outline') return 'var(--sb-button-outlineBorder) 0 0 0 1px inset';
    if (variant === 'ghost') return 'var(--sb-button-ghostBorder) 0 0 0 1px inset';
    return 'var(--sb-button-solidBorder) 0 0 0 1px inset';
  })(),
  borderRadius: 4,
  // Making sure that the button never shrinks below its minimum size
  flexShrink: 0,

  '&:hover': {
    color: (() => {
      if (variant === 'solid') return 'var(--sb-button-solidHoverText)';
      if (variant === 'outline') return 'var(--sb-button-outlineHoverText)';
      if (variant === 'ghost') return 'var(--sb-button-ghostHoverText)';
      return 'var(--sb-button-solidHoverText)';
    })(),
    background: (() => {
      if (variant === 'solid') return 'var(--sb-button-solidHoverBackground)';
      if (variant === 'outline') return 'var(--sb-button-outlineHoverBackground)';
      if (variant === 'ghost') return 'var(--sb-button-ghostHoverBackground)';
      return 'var(--sb-button-solidHoverBackground)';
    })(),
  },

  '&:active': {
    color: (() => {
      if (variant === 'solid') return 'var(--sb-button-solidActiveText)';
      if (variant === 'outline') return 'var(--sb-button-outlineActiveText)';
      if (variant === 'ghost') return 'var(--sb-button-ghostActiveText)';
      return 'var(--sb-button-solidActiveText)';
    })(),
    background: (() => {
      if (variant === 'solid') return 'var(--sb-button-solidActiveBackground)';
      if (variant === 'outline') return 'var(--sb-button-outlineActiveBackground)';
      if (variant === 'ghost') return 'var(--sb-button-ghostActiveBackground)';
      return 'var(--sb-button-solidActiveBackground)';
    })(),
  },

  '&:focus': {
    boxShadow: 'var(--sb-button-focusBorder) 0 0 0 1px inset',
    outline: 'none',
  },

  '> svg': {
    animation:
      animating && animation !== 'none' ? `${theme.animation[animation]} 1000ms ease-out` : '',
  },
}));
