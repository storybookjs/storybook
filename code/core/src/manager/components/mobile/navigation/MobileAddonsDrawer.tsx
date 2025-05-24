import type { FC, ReactNode } from 'react';
import React, { useEffect, useRef } from 'react';

import { styled } from 'storybook/theming';

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
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogNode = dialogRef.current;
    if (dialogNode) {
      if (isOpen) {
        if (!dialogNode.hasAttribute('open')) {
          dialogNode.showModal();
        }
      } else {
        if (dialogNode.hasAttribute('open')) {
          dialogNode.close();
        }
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const dialogNode = dialogRef.current;
    if (dialogNode) {
      const handleDialogCloseEvent = () => {
        if (isOpen) {
          onClose();
        }
      };
      dialogNode.addEventListener('close', handleDialogCloseEvent);
      return () => {
        dialogNode.removeEventListener('close', handleDialogCloseEvent);
      };
    }
    return undefined;
  }, [isOpen, onClose]);

  return (
    <Container ref={dialogRef} id={id} aria-label="Addon panel">
      {children}
    </Container>
  );
};
