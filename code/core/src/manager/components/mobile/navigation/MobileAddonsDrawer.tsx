import type { FC, ReactNode } from 'react';
import React from 'react';

import { styled } from 'storybook/theming';

interface MobileAddonsDrawerProps {
  children: ReactNode;
  id?: string;
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

export const MobileAddonsDrawer: FC<MobileAddonsDrawerProps> = ({ children, id }) => {
  return (
    <Container
      id={id}
      role="dialog"
      aria-modal="true"
      aria-label="Addon panel"
    >
      {children}
    </Container>
  );
};
