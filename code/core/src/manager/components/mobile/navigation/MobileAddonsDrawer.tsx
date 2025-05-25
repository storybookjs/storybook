import type { FC, ReactNode } from 'react';
import React from 'react';

import { styled } from 'storybook/theming';

import { useModalDialog } from '../../../hooks/useModalDialog';

interface MobileAddonsDrawerProps {
  children: ReactNode;
  id?: string;
  isOpen: boolean;
  onClose: () => void;
}

const Container = styled.dialog(({ theme }) => ({
  position: 'relative',
  boxSizing: 'border-box',
  width: '100%',
  background: theme.background.content,
  height: '42vh',
  zIndex: 11,
  overflow: 'hidden',
  border: 'none',
  padding: 0,
}));

export const MobileAddonsDrawer: FC<MobileAddonsDrawerProps> = ({
  children,
  id,
  isOpen,
  onClose,
}) => {
  const dialogRef = useModalDialog({ isOpen, onClose });

  return (
    <Container ref={dialogRef} id={id} aria-label="Addon panel">
      {children}
    </Container>
  );
};
