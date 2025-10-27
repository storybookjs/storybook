import React, { type ComponentProps } from 'react';

import { styled } from 'storybook/theming';

import { Button } from '../Button/Button';

export const Listbox = styled.ul(({ theme }) => ({
  listStyle: 'none',
  margin: 0,
  padding: 4,

  '& + *': {
    borderTop: `1px solid ${theme.appBorderColor}`,
  },
}));

export const ListboxItem = styled.li({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 4,

  '@supports (interpolate-size: allow-keywords)': {
    interpolateSize: 'allow-keywords',
    overflow: 'hidden',
    transition: 'all var(--transition-duration, 0.2s)',
    transitionBehavior: 'allow-discrete',
  },

  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },

  '&.enter': {
    opacity: 0,
    blockSize: 0,
    contentVisibility: 'hidden',
  },
  '&.enter-active': {
    opacity: 1,
    blockSize: 'auto',
    contentVisibility: 'visible',
  },
  '&.exit': {
    opacity: 1,
    blockSize: 'auto',
    contentVisibility: 'visible',
  },
  '&.exit-active': {
    opacity: 0,
    blockSize: 0,
    contentVisibility: 'hidden',
  },
});

export const ListboxButton = ({
  padding = 'small',
  size = 'medium',
  variant = 'ghost',
  ...props
}: ComponentProps<typeof Button>) => (
  <Button {...props} variant={variant} padding={padding} size={size} />
);

export const ListboxAction = styled(ListboxButton)(({ active, theme }) => ({
  flexGrow: 1,
  textAlign: 'start',
  justifyContent: 'flex-start',
  fontWeight: theme.typography.weight.regular,
  color: active ? theme.color.secondary : theme.color.defaultText,
  '&:hover': {
    color: active ? theme.color.secondary : theme.color.defaultText,
  },
}));

export const ListboxText = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s1,
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
}));
