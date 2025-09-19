import type { FC } from 'react';
import React from 'react';

import { Tab, type TabProps } from 'react-aria-components';
import { styled } from 'storybook/theming';

export type StatelessTabProps = TabProps;

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

export const StatelessTab: FC<StatelessTabProps> = (props) => {
  return <StyledTab {...props} />;
};
