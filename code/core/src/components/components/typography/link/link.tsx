import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import React, { forwardRef } from 'react';

import { ChevronRightIcon } from '@storybook/icons';

import { darken } from 'polished';
import { styled } from 'storybook/theming';

// Cmd/Ctrl/Shift/Alt + Click should trigger default browser behavior. Same applies to non-left clicks
const LEFT_BUTTON = 0;

const isPlainLeftClick = (e: MouseEvent) =>
  e.button === LEFT_BUTTON && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;

const cancelled = (e: MouseEvent, cb: (_e: MouseEvent) => void) => {
  if (isPlainLeftClick(e)) {
    e.preventDefault();
    cb(e);
  }
};

export interface LinkStylesProps {
  secondary?: boolean;
  tertiary?: boolean;
  nochrome?: boolean;
  inverse?: boolean;
  isButton?: boolean;
}

export interface LinkInnerProps {
  withArrow?: boolean;
  containsIcon?: boolean;
}

const LinkInner = styled.span<LinkInnerProps>(
  ({ withArrow }) =>
    withArrow
      ? {
          '> svg:last-of-type': {
            height: '0.7em',
            width: '0.7em',
            marginRight: 0,
            marginLeft: '0.25em',
            bottom: 'auto',
            verticalAlign: 'inherit',
          },
        }
      : {},
  ({ containsIcon }) =>
    containsIcon
      ? {
          svg: {
            height: '1em',
            width: '1em',
            verticalAlign: 'middle',
            position: 'relative',
            bottom: 0,
            marginRight: 0,
          },
        }
      : {}
);

type AProps = AnchorHTMLAttributes<HTMLAnchorElement>;

const A = styled.a<LinkStylesProps>(
  ({ theme }) => ({
    display: 'inline-block',
    transition: 'all 150ms ease-out',
    // Ensure WCAG Level A compliance (SC 1.4.1), see https://www.w3.org/WAI/WCAG22/Techniques/failures/F73
    textDecoration: 'underline',
    textDecorationThickness: '0.5px',
    textUnderlineOffset: '0.11em',

    color: theme.color.secondary,

    '&:hover, &:focus': {
      cursor: 'pointer',
      color: darken(0.07, theme.color.secondary),
      'svg path:not([fill])': {
        fill: darken(0.07, theme.color.secondary),
      },
    },
    '&:active': {
      color: darken(0.1, theme.color.secondary),
      'svg path:not([fill])': {
        fill: darken(0.1, theme.color.secondary),
      },
    },

    svg: {
      display: 'inline-block',
      height: '1em',
      width: '1em',
      verticalAlign: 'text-top',
      position: 'relative',
      bottom: '-0.125em',
      marginRight: '0.4em',

      '& path': {
        fill: theme.color.secondary,
      },
    },
  }),
  ({ theme, secondary, tertiary }) => {
    let colors;
    if (secondary) {
      colors = [theme.textMutedColor, theme.color.secondary, theme.color.secondary];
    }
    if (tertiary) {
      colors = [theme.color.dark, theme.color.secondary, theme.color.secondary];
    }

    return colors
      ? {
          color: colors[0],
          'svg path:not([fill])': {
            fill: colors[0],
          },

          '&:hover': {
            color: colors[1],
            'svg path:not([fill])': {
              fill: colors[1],
            },
          },

          '&:active': {
            color: colors[2],
            'svg path:not([fill])': {
              fill: colors[2],
            },
          },
        }
      : {};
  },
  ({ nochrome }) =>
    nochrome
      ? {
          color: 'inherit',

          '&:hover, &:active': {
            color: 'inherit',
            textDecoration: 'underline',
          },
        }
      : {},
  ({ theme, inverse }) =>
    inverse
      ? {
          color: theme.color.lightest,
          ':not([fill])': {
            fill: theme.color.lightest,
          },

          '&:hover': {
            color: theme.color.lighter,
            'svg path:not([fill])': {
              fill: theme.color.lighter,
            },
          },

          '&:active': {
            color: theme.color.light,
            'svg path:not([fill])': {
              fill: theme.color.light,
            },
          },
        }
      : {},
  ({ isButton }) =>
    isButton
      ? {
          border: 0,
          borderRadius: 0,
          background: 'none',
          padding: 0,
          fontSize: 'inherit',
          // Button-styled links should not have underlines
          textDecoration: 'none',
        }
      : {}
);

export interface LinkProps extends LinkInnerProps, LinkStylesProps, AProps {
  cancel?: boolean;
  className?: string;
  style?: object;
  onClick?: (e: MouseEvent) => void;
  href?: string;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  (
    {
      cancel = true,
      children,
      onClick = undefined,
      withArrow = false,
      containsIcon = false,
      className = undefined,
      style = undefined,
      isButton = false,
      ...rest
    },
    ref
  ) => (
    <A
      {...rest}
      ref={ref}
      isButton={isButton}
      role={isButton ? 'button' : undefined}
      onClick={onClick && cancel ? (e) => cancelled(e, onClick) : onClick}
      className={className}
    >
      <LinkInner withArrow={withArrow} containsIcon={containsIcon}>
        {children}
        {withArrow && <ChevronRightIcon />}
      </LinkInner>
    </A>
  )
);
Link.displayName = 'Link';
