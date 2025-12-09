import React, { Fragment } from 'react';

import { BrowserIcon, MobileIcon, TabletIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import type { Viewport } from './types';

export const ActiveViewportSize = styled.div({
  display: 'inline-flex',
  alignItems: 'center',
});

export const ActiveViewportLabel = styled.div(({ theme }) => ({
  display: 'inline-block',
  textDecoration: 'none',
  padding: 10,
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s2 - 1,
  lineHeight: '1',
  height: 40,
  border: 'none',
  borderTop: '3px solid transparent',
  borderBottom: '3px solid transparent',
  background: 'transparent',
}));

export const iconsMap: Record<NonNullable<Viewport['type']>, React.ReactNode> = {
  desktop: <BrowserIcon />,
  mobile: <MobileIcon />,
  tablet: <TabletIcon />,
  other: <Fragment />,
};
