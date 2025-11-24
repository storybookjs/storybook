import type { ComponentProps } from 'react';
import React, { forwardRef, useEffect, useMemo, useState } from 'react';

import { deprecate } from 'storybook/internal/client-logger';

import { Slot } from '@radix-ui/react-slot';
import { darken, lighten, rgba, transparentize } from 'polished';
import { type API_KeyCollection, shortcutToAriaKeyshortcuts } from 'storybook/manager-api';
import { isPropValid, styled } from 'storybook/theming';

import { InteractiveTooltipWrapper } from './helpers/InteractiveTooltipWrapper';
import { useAriaDescription } from './helpers/useAriaDescription';

export interface ButtonProps extends Omit<ComponentProps<typeof StyledButton>, 'as'> {
  as?: ComponentProps<typeof StyledButton>['as'] | typeof Slot;
  asChild?: boolean;

  /**
   * A concise action label for the button announced by screen readers. Needed for buttons without
   * text or with text that relies on visual cues to be understood. Pass false to indicate that the
   * Button's content is already accessible to all. When a string is passed, it is also used as the
   * default tooltip text.
   */
  ariaLabel?: string | false;

  /**
   * An optional tooltip to display when the Button is hovered. If the Button has no text content,
   * consider making this the same as the aria-label.
   */
  tooltip?: string;

  /**
   * Only use this flag when tooltips on button interfere with other keyboard interactions, like
   * when building a custom select or menu button. Disables tooltips from the `tooltip`, `shortcut`
   * and `ariaLabel` props.
   */
  disableAllTooltips?: boolean;

  /**
   * A more thorough description of what the Button does, provided to non-sighted users through an
   * aria-describedby attribute. Use sparingly for buttons that trigger complex actions.
   */
  ariaDescription?: string;

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
      as = 'button',
      asChild = false,
      animation = 'none',
      size = 'small',
      variant = 'outline',
      padding = 'medium',
      disabled = false,
      readOnly = false,
      active,
      onClick,
      ariaLabel,
      ariaDescription = undefined,
      tooltip = undefined,
      shortcut = undefined,
      disableAllTooltips = false,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : as;

    if (ariaLabel === undefined || ariaLabel === '') {
      deprecate(
        `The 'ariaLabel' prop on 'Button' will become mandatory in Storybook 11. Buttons with text content should set 'ariaLabel={false}' to indicate that they are accessible as-is. Buttons without text content must provide a meaningful 'ariaLabel' for accessibility. The button content is: ${props.children}.`
      );

      // TODO in Storybook 11
      // throw new Error(
      //   'Button requires an ARIA label to be accessible. Please provide a valid ariaLabel prop.'
      // );
    }

    if (active !== undefined) {
      deprecate(
        'The `active` prop on `Button` is deprecated and will be removed in Storybook 11. Use specialized components like `ToggleButton` or `Select` instead.'
      );
    }

    const { ariaDescriptionAttrs, AriaDescription } = useAriaDescription(ariaDescription);

    const shortcutAttribute = useMemo(() => {
      return shortcut ? shortcutToAriaKeyshortcuts(shortcut) : undefined;
    }, [shortcut]);

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

    const finalTooltip = tooltip || (ariaLabel !== false ? ariaLabel : undefined);

    return (
      <>
        <InteractiveTooltipWrapper
          disableAllTooltips={disableAllTooltips}
          shortcut={shortcut}
          tooltip={finalTooltip}
        >
          <StyledButton
            as={Comp}
            ref={ref}
            variant={variant}
            size={size}
            padding={padding}
            disabled={disabled || readOnly}
            readOnly={readOnly}
            active={active}
            animating={isAnimating}
            animation={animation}
            onClick={handleClick}
            aria-label={!readOnly && ariaLabel !== false ? ariaLabel : undefined}
            aria-keyshortcuts={readOnly ? undefined : shortcutAttribute}
            {...(readOnly ? {} : ariaDescriptionAttrs)}
            {...props}
          />
        </InteractiveTooltipWrapper>
        <AriaDescription />
      </>
    );
  }
);

Button.displayName = 'Button';

// This is just an example of structured hierarchy.
// I would expect our CSS custom prop names to follow suit.
// For example, using the below structure:
// color: var( --Button-default-fgColor-rest );
const exampleTokenStructure = {
  default: {
    fgColor: {
      rest: 'color',
      hover: 'color',
      active: 'color',
      selected: 'color',
      disabled: 'color',
    },
    bgColor: {},
    borderColor: {},
    // do we separate font stuff?
    fontSize: {},
    fontWeight: {},
    // sizes?
  },
  outline: {},
  danger: {},
  warning: {},
  accent: {},
  ghost: {},
};

// This whole set of styles needs a mega refactor
const StyledButton = styled('button', {
  shouldForwardProp: (prop) => isPropValid(prop),
})<{
  // Why are size AND padding defined?
  size?: 'small' | 'medium';
  padding?: 'small' | 'medium' | 'none';
  // Need to rename variants
  variant?: 'outline' | 'solid' | 'ghost';
  active?: boolean;
  disabled?: boolean;
  // What is this for?
  readOnly?: boolean;
  // Do we need separate props for animation and animating?
  animating?: boolean;
  animation?: 'none' | 'rotate360' | 'glow' | 'jiggle';
}>(
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
    // Create CSS custom props for reuse - feels messy initially because tokens not using convert.
    '--Button-fgColor-default':
      theme.base === 'dark'
        ? theme.tokens.dark.fgColor.default
        : theme.tokens.light.fgColor.default,
    '--Button-fgColor-ghost':
      theme.base === 'dark' ? theme.tokens.dark.fgColor.mute : theme.tokens.light.fgColor.mute,
    '--Button-fgColor-accent': '#ffffff', // need to be able to handle this
    '--Button-bgColor-default':
      theme.base === 'dark'
        ? theme.tokens.dark.bgColor.default
        : theme.tokens.light.bgColor.default,
    '--Button-bgColor-ghost': 'transparent',
    '--Button-bgColor-accent':
      theme.base === 'dark' ? theme.tokens.dark.bgColor.accent : theme.tokens.light.bgColor.accent,
    '--Button-fontSize-medium': `${theme.typography.size.s1}px`,

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
    // fixed heights are bad
    height: size === 'small' ? '28px' : '32px',
    position: 'relative',
    textAlign: 'center',
    textDecoration: 'none',
    transitionProperty: 'background, box-shadow',
    transitionDuration: '150ms',
    transitionTimingFunction: 'ease-out',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
    // needed?
    userSelect: 'none',
    opacity: disabled && !readOnly ? 0.5 : 1,
    margin: 0,
    fontSize: 'var( --Button-fontSize-medium )',
    fontWeight: theme.typography.weight.bold,
    // Too restrictive probably
    lineHeight: '1',
    background: (() => {
      switch (variant) {
        case 'solid':
          return 'var( --Button-bgColor-accent )';
        case 'ghost':
          return 'var( --Button-bgColor-ghost )';
        default:
          return 'var( --Button-bgColor-default )';
      }
    })(),
    color: (() => {
      switch (variant) {
        case 'solid':
          return 'var( --Button-fgColor-accent )';
        case 'ghost':
          return 'var( --Button-fgColor-ghost )';
        default:
          return 'var( --Button-fgColor-default )';
      }
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
            bgColor =
              theme.base === 'light'
                ? lighten(0.1, theme.color.secondary)
                : darken(0.3, theme.color.secondary);
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

      '&:focus-visible': {
        outline: `2px solid ${rgba(theme.color.secondary, 1)}`,
        outlineOffset: 2,
        // Should ensure focus outline gets drawn above next sibling
        zIndex: '1',
      },

      '.sb-bar &:focus-visible, .sb-list &:focus-visible': {
        outlineOffset: 0,
      },
    }),

    '> svg': {
      flex: '0 0 auto',
      animation:
        animating && animation !== 'none' ? `${theme.animation[animation]} 1000ms ease-out` : '',
    },
  })
);

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  deprecate(
    '`IconButton` is deprecated and will be removed in Storybook 11, use `Button` instead.'
  );

  return <Button ref={ref} {...props} />;
});
IconButton.displayName = 'IconButton';
