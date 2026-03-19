import React, { type HTMLAttributes, forwardRef } from 'react';

import { CloseIcon } from '@storybook/icons';

import { lighten, styled } from 'storybook/theming';

import { Button } from '../Button/Button';

export interface PopoverProps extends HTMLAttributes<HTMLDivElement> {
  /** Content of the popover. */
  children: React.ReactNode;

  /** Preset popover color taken from the theme, affecting both bathground and foreground. */
  color?: 'default' | 'inverse' | 'positive' | 'negative' | 'warning' | 'none';

  /** Whether the popover is rendered with a decorative window-like appearance. */
  hasChrome: boolean;

  /** Optional callback connected to a close button. Then button is shown only when passed. */
  onHide?: () => void;

  /** Optional custom label for the close button, if there is one. */
  hideLabel?: string;

  /** Padding between the content and popover edge. */
  padding?: number | string;
}

const Wrapper = styled.div<{
  bgColor: NonNullable<PopoverProps['color']>;
  hasChrome: boolean;
  hasCloseButton: boolean;
  padding: NonNullable<PopoverProps['padding']>;
}>(
  ({ hasCloseButton, padding }) => ({
    display: 'inline-block',
    position: 'relative',
    minHeight: hasCloseButton ? 36 : undefined,
    zIndex: 2147483647,
    colorScheme: 'light dark',
    padding,
  }),
  ({ theme, hasChrome }) =>
    hasChrome
      ? {
          filter: `
            drop-shadow(0px 5px 5px rgba(0,0,0,0.05))
            drop-shadow(0 1px 3px rgba(0,0,0,0.1))
          `,
          borderRadius: theme.appBorderRadius + 2,
          fontSize: theme.typography.size.s1,
        }
      : {},
  ({ theme, bgColor }) =>
    bgColor === 'default' && {
      background: theme.base === 'light' ? lighten(theme.background.app) : theme.background.app,
      color: theme.color.defaultText,
    },
  ({ theme, bgColor }) =>
    bgColor === 'inverse' && {
      background: theme.base === 'light' ? theme.color.darkest : theme.color.lightest,
      color: theme.color.inverseText,
    },
  ({ theme, bgColor }) =>
    (bgColor === 'positive' || bgColor === 'negative' || bgColor === 'warning') && {
      background: theme.background[bgColor],
      color: theme.color[`${bgColor}Text`],
    }
);

const AbsoluteButton = styled(Button)({
  position: 'absolute',
  top: 4,
  right: 4,
});

export const Popover = forwardRef<HTMLDivElement, PopoverProps>(
  (
    {
      children,
      color = 'default',
      hasChrome = true,
      hideLabel = 'Close',
      onHide,
      padding = 8,
      ...props
    },
    ref
  ) => {
    return (
      <Wrapper
        bgColor={color}
        hasChrome={hasChrome}
        hasCloseButton={!!onHide}
        padding={padding}
        ref={ref}
        {...props}
      >
        {children}
        {onHide && (
          <AbsoluteButton
            ariaLabel={hideLabel}
            onClick={onHide}
            padding="small"
            variant="ghost"
            size="small"
          >
            <CloseIcon />
          </AbsoluteButton>
        )}
      </Wrapper>
    );
  }
);

Popover.displayName = 'Popover';
