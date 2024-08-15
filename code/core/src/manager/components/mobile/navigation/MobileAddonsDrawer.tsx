import type { FC, ReactNode } from 'react';
import React from 'react';

import { styled } from '@storybook/core/theming';

interface MobileAddonsDrawerProps {
  children: ReactNode;
}

const Container = styled.div(({ theme }) => ({
  position: 'relative',
  boxSizing: 'border-box',
  width: '100%',
  background: theme.background.content,
  height: '42vh',
  zIndex: 11,
  overflow: 'hidden',
}));

export const MobileAddonsDrawer: FC<MobileAddonsDrawerProps> = ({ children }) => {
  return <Container>{children}</Container>;
};
