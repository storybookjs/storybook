import type { FC, ReactNode } from 'react';
import React, { useCallback, useRef } from 'react';

import { Transition } from 'react-transition-group';
import type { TransitionStatus } from 'react-transition-group/Transition';
import { styled } from 'storybook/theming';

import { MOBILE_TRANSITION_DURATION } from '../../../constants';
import { useModalDialog } from '../../../hooks/useModalDialog';

interface MobileAddonsDrawerProps {
  children: ReactNode;
  id?: string;
  isOpen: boolean;
  onClose: () => void;
}

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
  height: '42vh',
  zIndex: 11,
  overflow: 'hidden',
  border: 'none',
  padding: 0,
  margin: 0,
  transform: `translateY(${(() => {
    if (state === 'entering' || state === 'entered') {
      return '0';
    }
    return '100%';
  })()})`,
  transition: `all ${MOBILE_TRANSITION_DURATION}ms ease-in-out`,
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

const ContentContainer = styled.div<{ state: TransitionStatus }>(({ state }) => ({
  width: '100%',
  height: '100%',
  transition: `all ${MOBILE_TRANSITION_DURATION}ms ease-in-out`,
  opacity: state === 'entered' || state === 'entering' ? 1 : 0,
}));

export const MobileAddonsDrawer: FC<MobileAddonsDrawerProps> = ({
  children,
  id,
  isOpen,
  onClose,
}) => {
  const dialogRef = useModalDialog({ isOpen, onClose });

  const forceCloseDialog = useCallback(() => {
    if (dialogRef.current && dialogRef.current.hasAttribute('open')) {
      dialogRef.current.close();
    }
  }, []);

  return (
    <Transition
      nodeRef={dialogRef}
      in={isOpen}
      timeout={MOBILE_TRANSITION_DURATION}
      mountOnEnter
      unmountOnExit
      onExited={() => {
        forceCloseDialog();
      }}
    >
      {(state) => (
        <Container ref={dialogRef} state={state} id={id} aria-label="Addon panel">
          <ContentContainer state={state}>{children}</ContentContainer>
        </Container>
      )}
    </Transition>
  );
};
