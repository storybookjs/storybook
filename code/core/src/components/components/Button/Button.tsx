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

    let deprecated = undefined;
    if (!readOnly && (ariaLabel === undefined || ariaLabel === '')) {
      deprecated = 'ariaLabel';
      deprecate(
        `The 'ariaLabel' prop on 'Button' will become mandatory in Storybook 11. Buttons with text content should set 'ariaLabel={false}' to indicate that they are accessible as-is. Buttons without text content must provide a meaningful 'ariaLabel' for accessibility. The button content is: ${props.children}.`
      );

      // TODO in Storybook 11
      // throw new Error(
      //   'Button requires an ARIA label to be accessible. Please provide a valid ariaLabel prop.'
      // );
    }

    if (active !== undefined) {
      deprecated = 'active';
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
            data-deprecated={deprecated}
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

const StyledButton = styled('button', {
  shouldForwardProp: (prop) => isPropValid(prop),
})<{
  size?: 'small' | 'medium';
  padding?: 'small' | 'medium' | 'none';
  variant?: 'outline' | 'solid' | 'ghost';
  active?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
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
    fontSize: `var(--sb-typography-size-s1)`,
    fontWeight: 'var(--sb-typography-weight-bold)',
    lineHeight: '1',
    background: (() => {
      if (variant === 'solid') {
        return theme.base === 'light'
          ? 'var(--sb-color-secondary)'
          : darken(0.18, theme.color.secondary);
      }

      if (variant === 'outline') {
        return 'var(--sb-button-background)';
      }

      if (variant === 'ghost' && active) {
        return transparentize(0.93, theme.barSelectedColor);
      }

      return 'transparent';
    })(),
    color: (() => {
      if (variant === 'solid') {
        return theme.color.lightest;
      }

      if (variant === 'outline') {
        return theme.input.color;
      }

      if (variant === 'ghost' && active) {
        return theme.base === 'light'
          ? darken(0.1, theme.color.secondary)
          : 'var(--sb-color-secondary)';
      }

      if (variant === 'ghost') {
        return 'var(--sb-textMutedColor)';
      }
      return 'var(--sb-input-color)';
    })(),
    boxShadow: variant === 'outline' ? `0 0 0 1px inset var(--sb-button-border)` : 'none',
    borderRadius: 'var(--sb-input-borderRadius)',
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
        color: variant === 'ghost' ? 'var(--sb-color-secondary)' : undefined,
        background: (() => {
          let bgColor = theme.color.secondary;

          if (variant === 'solid') {
            bgColor = theme.color.secondary;
          }

          if (variant === 'outline') {
            bgColor = theme.button.background;
          }

          if (variant === 'ghost') {
            return 'var(--sb-background-hoverable)';
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

  return <Button ref={ref} {...props} data-deprecated="IconButton" />;
});
IconButton.displayName = 'IconButton';
