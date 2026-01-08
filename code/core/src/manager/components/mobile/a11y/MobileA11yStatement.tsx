import type { FC } from 'react';
import React, { useEffect, useRef } from 'react';

import { Button, ScrollArea } from 'storybook/internal/components';

import { ArrowLeftIcon } from '@storybook/icons';

import { useTransitionState } from 'react-transition-state';
import { keyframes, styled } from 'storybook/theming';

import { MOBILE_TRANSITION_DURATION } from '../../../constants';
import { A11yStatement } from '../../a11y/A11yStatement';
import { useLayout } from '../../layout/LayoutProvider';

export const MobileA11yStatement: FC = () => {
  const { isMobileA11yStatementOpen, setMobileA11yStatementOpen } = useLayout();
  const pageRef = useRef(null);

  const [state, toggle] = useTransitionState({
    timeout: MOBILE_TRANSITION_DURATION,
    mountOnEnter: true,
    unmountOnExit: true,
  });

  // Update transition state when isMobileA11yStatementOpen changes
  useEffect(() => {
    toggle(isMobileA11yStatementOpen);
  }, [isMobileA11yStatementOpen, toggle]);

  if (!state.isMounted) {
    return null;
  }

  return (
    <Container
      ref={pageRef}
      $status={state.status}
      $transitionDuration={MOBILE_TRANSITION_DURATION}
    >
      <ScrollArea vertical offset={3} scrollbarSize={6}>
        <InnerArea>
          <CloseButton
            onClick={() => setMobileA11yStatementOpen(false)}
            ariaLabel="Close accessibility statement"
            variant="ghost"
          >
            <ArrowLeftIcon />
            Back
          </CloseButton>
          <A11yStatement />
        </InnerArea>
      </ScrollArea>
    </Container>
  );
};

const slideFromRight = keyframes({
  from: {
    opacity: 0,
    transform: 'translate(20px, 0)',
  },
  to: {
    opacity: 1,
    transform: 'translate(0, 0)',
  },
});

const slideToRight = keyframes({
  from: {
    opacity: 1,
    transform: 'translate(0, 0)',
  },
  to: {
    opacity: 0,
    transform: 'translate(20px, 0)',
  },
});

const Container = styled.div<{ $status: string; $transitionDuration: number }>(
  ({ theme, $status, $transitionDuration }) => ({
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    zIndex: 11,
    overflow: 'auto',
    color: theme.color.defaultText,
    background: theme.background.content,
    animation:
      $status === 'exiting'
        ? `${slideToRight} ${$transitionDuration}ms`
        : `${slideFromRight} ${$transitionDuration}ms`,
  })
);

const InnerArea = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  padding: '25px 12px 20px',
});

const CloseButton = styled(Button)({
  alignSelf: 'start',
});
