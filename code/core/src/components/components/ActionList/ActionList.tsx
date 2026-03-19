import React, { type ComponentProps, forwardRef } from 'react';

import { darken, transparentize } from 'polished';
import type { TransitionStatus } from 'react-transition-state';
import { styled } from 'storybook/theming';

import { Button } from '../Button/Button';
import { ToggleButton } from '../ToggleButton/ToggleButton';

const ActionListItem = styled.li<{
  active?: boolean;
  transitionStatus?: TransitionStatus;
}>(
  ({ active, theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: '0 0 auto',
    overflow: 'hidden',
    minHeight: 32,
    gap: 4,

    fontSize: theme.typography.size.s1,
    fontWeight: active ? theme.typography.weight.bold : theme.typography.weight.regular,
    color: active ? 'var(--listbox-item-active-color)' : theme.color.defaultText,
    '--listbox-item-active-color':
      theme.base === 'light' ? darken(0.1, theme.color.secondary) : theme.color.secondary,
    '--listbox-item-muted-color': active
      ? 'var(--listbox-item-active-color)'
      : theme.color.mediumdark,

    '&[aria-disabled="true"]': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    '&[aria-selected="true"]': {
      color: 'var(--listbox-item-active-color)',
      fontWeight: theme.typography.weight.bold,
      '--listbox-item-muted-color': 'var(--listbox-item-active-color)',
    },

    '&:not(:hover, :has(:focus-visible)) svg + input': {
      position: 'absolute',
      opacity: 0,
    },

    '&[role="option"]': {
      cursor: 'pointer',
      borderRadius: theme.input.borderRadius,
      outlineOffset: -2,
      padding: '0 9px',
      gap: 8,

      '&:hover': {
        background: transparentize(0.86, theme.color.secondary),
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.color.secondary}`,
      },
    },

    '@supports (interpolate-size: allow-keywords)': {
      interpolateSize: 'allow-keywords',
      transitionBehavior: 'allow-discrete',
      transitionDuration: 'var(--transition-duration, 0.2s)',
      transitionProperty: 'opacity, block-size, content-visibility',
    },

    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),
  ({ transitionStatus }) => {
    switch (transitionStatus) {
      case 'preEnter':
      case 'exiting':
      case 'exited':
        return {
          opacity: 0,
          blockSize: 0,
          contentVisibility: 'hidden',
        };
      default:
        return {
          opacity: 1,
          blockSize: 'auto',
          contentVisibility: 'visible',
        };
    }
  }
);

/**
 * A ActionList item that shows/hides child elements on hover based on the targetId. Child elements
 * must have a `data-target-id` attribute matching the `targetId` prop to be affected by the hover
 * behavior.
 */
const ActionListHoverItem = styled(ActionListItem)<{ targetId: string }>(({ targetId }) => ({
  gap: 0,
  [`& [data-target-id="${targetId}"]`]: {
    inlineSize: 'auto',
    marginLeft: 4,
    opacity: 1,
    '@supports (interpolate-size: allow-keywords)': {
      interpolateSize: 'allow-keywords',
      transitionProperty: 'inline-size, margin-left, opacity, padding-inline',
      transitionDuration: 'var(--transition-duration, 0.2s)',
    },
  },
  [`&:not(:hover, :has(:focus-visible)) [data-target-id="${targetId}"]`]: {
    inlineSize: 0,
    marginLeft: 0,
    opacity: 0,
    paddingInline: 0,
  },
}));

const StyledButton = styled(Button)(({ size }) => ({
  gap: size === 'small' ? 6 : 8,

  '&:focus-visible': {
    // Prevent focus outline from being cut off by overflow: hidden
    outlineOffset: -2,
  },
}));

const StyledToggleButton = styled(ToggleButton)({
  '&:focus-visible': {
    // Prevent focus outline from being cut off by overflow: hidden
    outlineOffset: -2,
  },
});

const ActionListButton = forwardRef<HTMLButtonElement, ComponentProps<typeof StyledButton>>(
  function ActionListButton(
    { padding = 'small', size = 'medium', variant = 'ghost', ...props },
    ref
  ) {
    return <StyledButton {...{ ...props, variant, padding, size, ref }} />;
  }
);

const ActionListToggle = forwardRef<HTMLButtonElement, ComponentProps<typeof StyledToggleButton>>(
  function ActionListToggle(
    { padding = 'small', size = 'medium', variant = 'ghost', ...props },
    ref
  ) {
    return <StyledToggleButton {...{ ...props, variant, padding, size, ref }} />;
  }
);

const ActionListAction = styled(ActionListButton)(({ theme }) => ({
  height: 'auto',
  minHeight: 32,
  flex: '0 1 100%',
  textAlign: 'start',
  justifyContent: 'space-between',
  fontWeight: 'inherit',
  color: 'inherit',
  '&:hover': {
    color: 'inherit',
  },
  '& input:enabled:focus-visible': {
    outline: 'none',
  },
  '&:has(input:focus-visible)': {
    outline: `2px solid ${theme.color.secondary}`,
    outlineOffset: -2,
  },
}));

const ActionListLink = (
  props: ComponentProps<typeof ActionListAction> & React.AnchorHTMLAttributes<HTMLAnchorElement>
) => <ActionListAction as="a" {...props} />;

const ActionListText = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  flexGrow: 1,
  minWidth: 0,
  padding: '8px 0',
  lineHeight: '16px',

  '& > *': {
    margin: 0,
    whiteSpace: 'normal',
  },
  '& > span': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& small': {
    fontSize: 'inherit',
    color: theme.textMutedColor,
  },
  '&:first-child': {
    paddingLeft: 8,
  },
  '&:last-child': {
    paddingRight: 8,
  },
  'button > &:first-child, [role="option"] > &:first-child': {
    paddingLeft: 0,
  },
  'button > &:last-child, [role="option"] > &:last-child': {
    paddingRight: 0,
  },
}));

const ActionListIcon = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 14px',
  width: 14,
  height: 14,
  color: 'var(--listbox-item-muted-color)',
});

export const ActionList = Object.assign(
  styled.ul(({ theme, onClick }) => ({
    listStyle: 'none',
    margin: 0,
    padding: 4,
    cursor: onClick ? 'pointer' : 'default',

    '& + *': {
      borderTop: `1px solid ${theme.appBorderColor}`,
    },
  })),
  {
    Item: ActionListItem,
    HoverItem: ActionListHoverItem,
    Button: ActionListButton,
    Toggle: ActionListToggle,
    Action: ActionListAction,
    Link: ActionListLink,
    Text: ActionListText,
    Icon: ActionListIcon,
  }
);
