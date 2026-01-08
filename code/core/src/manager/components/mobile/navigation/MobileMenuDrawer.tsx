import type { FC, ReactNode } from 'react';
import React from 'react';

import { Modal } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

import { MOBILE_TRANSITION_DURATION } from '../../../constants';
import { MobileA11yStatement } from '../a11y/MobileA11yStatement';
import { MobileAbout } from '../about/MobileAbout';

interface MobileMenuDrawerProps {
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

export const MobileMenuDrawer: FC<MobileMenuDrawerProps> = ({
  children,
  id,
  isOpen,
  onOpenChange,
}) => {
  return (
    <StyledModal
      ariaLabel="Menu"
      transitionDuration={MOBILE_TRANSITION_DURATION}
      variant="bottom-drawer"
      height="80vh"
      id={id}
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      {children}
      <MobileA11yStatement />
      <MobileAbout />
    </StyledModal>
  );
};
