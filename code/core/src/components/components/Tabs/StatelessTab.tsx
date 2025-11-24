import type { FC } from 'react';
import React from 'react';

import { Tab } from 'react-aria-components/patched-dist/Tabs';
import { styled } from 'storybook/theming';

export interface StatelessTabProps {
  /** Unique id of the Tab, must match that of its corresponding TabPanel. */
  name: string;

  /** Tab button content */
  children: React.ReactNode;
}

const StyledTab = styled(Tab)(({ theme }) => ({
  whiteSpace: 'normal',
  display: 'inline-flex',
  overflow: 'hidden',
  verticalAlign: 'top',
  justifyContent: 'center',
  alignItems: 'center',
  textAlign: 'center',
  textDecoration: 'none',
  scrollSnapAlign: 'start',
  '&:empty': {
    display: 'none',
  },
  '&[hidden]': {
    display: 'none',
  },
  padding: '0 15px',
  transition: 'color 0.2s linear, border-bottom-color 0.2s linear',
  height: 40,
  lineHeight: '12px',
  cursor: 'pointer',
  background: 'transparent',
  border: '0 solid transparent',
  borderTop: '3px solid transparent',
  borderBottom: '3px solid transparent',
  fontWeight: 'bold',
  fontSize: 13,
  '&:focus-visible': {
    outline: '0 none',
    boxShadow: `inset 0 0 0 2px ${theme.barSelectedColor}`,
  },
  color: theme.barTextColor,
  borderBottomColor: 'transparent',
  '&:hover': {
    color: theme.barHoverColor,
  },
  '&[data-selected]': {
    color: theme.barSelectedColor,
    borderBottomColor: theme.barSelectedColor,
  },
}));

export const StatelessTab: FC<StatelessTabProps> = ({ name, ...props }) => {
  return <StyledTab id={name} {...props} />;
};
