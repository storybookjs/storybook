import type { FC } from 'react';
import React, { useCallback, useRef } from 'react';

import { Transition } from 'react-transition-group';
import type { TransitionStatus } from 'react-transition-group/Transition';
import { styled } from 'storybook/theming';

import { MOBILE_TRANSITION_DURATION } from '../../../constants';
import { useModalDialog } from '../../../hooks/useModalDialog';
import { useLayout } from '../../layout/LayoutProvider';
import { MobileAbout } from '../about/MobileAbout';

interface MobileMenuDrawerProps {
  children?: React.ReactNode;
  id?: string;
}

export const MobileMenuDrawer: FC<MobileMenuDrawerProps> = ({ children, id }) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { isMobileMenuOpen, setMobileMenuOpen, isMobileAboutOpen, setMobileAboutOpen } =
    useLayout();

  const handleClose = useCallback(() => {
    setMobileMenuOpen(false);
  }, [setMobileMenuOpen]);

  const dialogRef = useModalDialog({
    isOpen: isMobileMenuOpen,
    onClose: handleClose,
  });

  const forceCloseDialog = useCallback(() => {
    if (dialogRef.current && dialogRef.current.hasAttribute('open')) {
      dialogRef.current.close();
    }
  }, []);

  return (
    <>
      <Transition
        nodeRef={dialogRef}
        in={isMobileMenuOpen}
        timeout={MOBILE_TRANSITION_DURATION}
        mountOnEnter
        unmountOnExit
        onExited={() => {
          setMobileAboutOpen(false);
          forceCloseDialog();
        }}
      >
        {(state) => (
          <Container ref={dialogRef} state={state} id={id} aria-label="Navigation menu">
            <Transition
              nodeRef={sidebarRef}
              in={!isMobileAboutOpen}
              timeout={MOBILE_TRANSITION_DURATION}
            >
              {(sidebarState) => (
                <SidebarContainer ref={sidebarRef} state={sidebarState}>
                  {children}
                </SidebarContainer>
              )}
            </Transition>
            <MobileAbout />
          </Container>
        )}
      </Transition>
      <Transition
        nodeRef={overlayRef}
        in={isMobileMenuOpen}
        timeout={MOBILE_TRANSITION_DURATION}
        mountOnEnter
        unmountOnExit
      >
        {(state) => (
          <Overlay
            ref={overlayRef}
            state={state}
            onClick={handleClose}
            aria-label="Close navigation menu"
          />
        )}
      </Transition>
    </>
  );
};

const Container = styled.dialog<{ state: TransitionStatus }>(({ theme, state }) => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  top: 'auto',
  boxSizing: 'border-box',
  width: '100%',
  maxWidth: '100vw',
  background: theme.background.content,
  height: '80%',
  zIndex: 11,
  borderRadius: '10px 10px 0 0',
  transition: `all ${MOBILE_TRANSITION_DURATION}ms ease-in-out`,
  overflow: 'hidden',
  transform: `${(() => {
    if (state === 'entering') {
      return 'translateY(0)';
    }

    if (state === 'entered') {
      return 'translateY(0)';
    }

    if (state === 'exiting') {
      return 'translateY(100%)';
    }

    if (state === 'exited') {
      return 'translateY(100%)';
    }
    return 'translateY(0)';
  })()}`,
  border: 'none',
  padding: 0,
  margin: 0,
  '&[open]': {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    top: 'auto',
    width: '100%',
    maxWidth: '100vw',
    margin: 0,
  },
}));

const SidebarContainer = styled.div<{ state: TransitionStatus }>(({ state }) => ({
  position: 'absolute',
  width: '100%',
  height: '100%',
  top: 0,
  left: 0,
  zIndex: 1,
  transition: `all ${MOBILE_TRANSITION_DURATION}ms ease-in-out`,
  overflow: 'hidden',
  opacity: `${(() => {
    if (state === 'entered') {
      return 1;
    }

    if (state === 'entering') {
      return 1;
    }

    if (state === 'exiting') {
      return 0;
    }

    if (state === 'exited') {
      return 0;
    }
    return 1;
  })()}`,
  transform: `${(() => {
    switch (state) {
      case 'entering':
      case 'entered':
        return 'translateX(0)';
      case 'exiting':
      case 'exited':
        return 'translateX(-20px)';
      default:
        return 'translateX(0)';
    }
  })()}`,
}));

const Overlay = styled.div<{ state: TransitionStatus }>(({ state }) => ({
  position: 'fixed',
  boxSizing: 'border-box',
  background: 'rgba(0, 0, 0, 0.5)',
  top: 0,
  bottom: 0,
  right: 0,
  left: 0,
  zIndex: 10,
  transition: `all ${MOBILE_TRANSITION_DURATION}ms ease-in-out`,
  cursor: 'pointer',
  opacity: `${(() => {
    switch (state) {
      case 'entering':
      case 'entered':
        return 1;
      case 'exiting':
      case 'exited':
        return 0;
      default:
        return 0;
    }
  })()}`,

  '&:hover': {
    background: 'rgba(0, 0, 0, 0.6)',
  },
}));
