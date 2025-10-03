import type { FC, ReactNode } from 'react';
import React from 'react';

import { Modal } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

import { MOBILE_TRANSITION_DURATION } from '../../../constants';

interface MobileAddonsDrawerProps {
  children: ReactNode;
  id?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const StyledModal = styled(Modal)(({ theme }) => ({
  background: theme.background.content,
  borderRadius: '10px 10px 0 0',
  border: 'none',
}));

export const MobileAddonsDrawer: FC<MobileAddonsDrawerProps> = ({
  children,
  id,
  isOpen,
  onOpenChange,
}) => {
  return (
    <StyledModal
      ariaLabel="Addon panel"
      transitionDuration={MOBILE_TRANSITION_DURATION}
      variant="bottom-drawer"
      height="42vh"
      id={id}
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      {children}
    </StyledModal>
  );
};
