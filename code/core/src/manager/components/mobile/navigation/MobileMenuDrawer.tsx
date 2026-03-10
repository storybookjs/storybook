import type { FC, ReactNode } from 'react';
import React from 'react';

import { Modal } from 'storybook/internal/components';

import { MOBILE_TRANSITION_DURATION } from '../../../constants';
import { MobileAbout } from '../about/MobileAbout';

interface MobileMenuDrawerProps {
  children: ReactNode;
  id?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const MobileMenuDrawer: FC<MobileMenuDrawerProps> = ({
  children,
  id,
  isOpen,
  onOpenChange,
}) => {
  return (
    <Modal
      ariaLabel="Menu"
      transitionDuration={MOBILE_TRANSITION_DURATION}
      variant="bottom-drawer"
      height="80vh"
      id={id}
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      {children}
      <MobileAbout />
    </Modal>
  );
};
