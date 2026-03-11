import type { FC, ReactNode } from 'react';
import React from 'react';

import { Modal } from 'storybook/internal/components';

import { MOBILE_TRANSITION_DURATION } from '../../../constants';

interface MobileAddonsDrawerProps {
  children: ReactNode;
  id?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const MobileAddonsDrawer: FC<MobileAddonsDrawerProps> = ({
  children,
  id,
  isOpen,
  onOpenChange,
}) => {
  return (
    <Modal
      ariaLabel="Addon panel"
      transitionDuration={MOBILE_TRANSITION_DURATION}
      variant="bottom-drawer"
      height="42vh"
      id={id}
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      {children}
    </Modal>
  );
};
