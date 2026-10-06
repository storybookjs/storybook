import type { FC, ReactNode } from 'react';
import React, { useEffect } from 'react';

import { Modal } from 'storybook/internal/components';

import { MOBILE_TRANSITION_DURATION } from '../../../constants.ts';
import { useLayout } from '../../layout/LayoutProvider.tsx';
import { MobileAbout } from '../about/MobileAbout.tsx';

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
  const { setMobileAboutOpen } = useLayout();

  // Reset the about overlay when the drawer closes, so reopening shows the menu again. Delayed
  // until the drawer's exit transition is done, so the menu does not flash in underneath.
  useEffect(() => {
    if (!isOpen) {
      const timeout = setTimeout(setMobileAboutOpen, MOBILE_TRANSITION_DURATION, false);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, setMobileAboutOpen]);

  return (
    <Modal
      ariaLabel="Menu"
      transitionDuration={MOBILE_TRANSITION_DURATION}
      variant="bottom-drawer"
      height="80dvh"
      id={id}
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      {children}
      <MobileAbout />
    </Modal>
  );
};
