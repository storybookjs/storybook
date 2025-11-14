import React, { type ComponentProps } from 'react';

import type { TransitionStatus } from 'react-transition-state';
import { styled } from 'storybook/theming';

import { Button } from '../Button/Button';

export const Listbox = styled.div(({ theme }) => ({
  listStyle: 'none',
  margin: 0,
  padding: 4,

  '& + *': {
    borderTop: `1px solid ${theme.appBorderColor}`,
  },
}));

export const ListboxItem = styled.li<{ active?: boolean; transitionStatus?: TransitionStatus }>(
  ({ active, theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,

    fontSize: theme.typography.size.s1,
    fontWeight: active ? theme.typography.weight.bold : theme.typography.weight.regular,
    color: active ? theme.color.secondary : theme.color.defaultText,
    '--listbox-item-muted-color': active ? theme.color.secondary : theme.color.mediumdark,

    '@supports (interpolate-size: allow-keywords)': {
      interpolateSize: 'allow-keywords',
      overflow: 'hidden',
      transition: 'all var(--transition-duration, 0.2s)',
      transitionBehavior: 'allow-discrete',
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

export const ListboxButton = ({
  padding = 'small',
  size = 'medium',
  variant = 'ghost',
  ...props
}: ComponentProps<typeof Button>) => (
  <Button {...props} variant={variant} padding={padding} size={size} />
);

export const ListboxAction = styled(ListboxButton)({
  flexGrow: 1,
  textAlign: 'start',
  justifyContent: 'space-between',
  fontWeight: 'inherit',
  color: 'inherit',
  '&:hover': {
    color: 'inherit',
  },
});

export const ListboxText = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexGrow: 1,
  padding: '8px 0',
  lineHeight: '16px',
  '&:first-child': {
    paddingLeft: 8,
  },
  '&:last-child': {
    paddingRight: 8,
  },
});

export const ListboxIcon = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  color: 'var(--listbox-item-muted-color)',
});
