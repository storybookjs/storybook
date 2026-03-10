import type { FC } from 'react';
import React, { useEffect, useRef } from 'react';

import { Button, Link, ScrollArea } from 'storybook/internal/components';

import { ArrowLeftIcon, GithubIcon, ShareAltIcon, StorybookIcon } from '@storybook/icons';

import { useTransitionState } from 'react-transition-state';
import { keyframes, styled } from 'storybook/theming';

import { MOBILE_TRANSITION_DURATION } from '../../../constants';
import { useLayout } from '../../layout/LayoutProvider';
import { UpgradeBlock } from '../../upgrade/UpgradeBlock';

export const MobileAbout: FC = () => {
  const { isMobileAboutOpen, setMobileAboutOpen } = useLayout();
  const aboutRef = useRef(null);

  const [state, toggle] = useTransitionState({
    timeout: MOBILE_TRANSITION_DURATION,
    mountOnEnter: true,
    unmountOnExit: true,
  });

  // Update transition state when isMobileAboutOpen changes
  useEffect(() => {
    toggle(isMobileAboutOpen);
  }, [isMobileAboutOpen, toggle]);

  if (!state.isMounted) {
    return null;
  }

  return (
    <Container
      ref={aboutRef}
      $status={state.status}
      $transitionDuration={MOBILE_TRANSITION_DURATION}
    >
      <ScrollArea vertical offset={3} scrollbarSize={6}>
        <InnerArea>
          <CloseButton
            onClick={() => setMobileAboutOpen(false)}
            ariaLabel="Close about section"
            tooltip="Close about section"
            variant="ghost"
          >
            <ArrowLeftIcon />
            Back
          </CloseButton>
          <LinkContainer>
            <LinkLine
              href="https://github.com/storybookjs/storybook"
              target="_blank"
              rel="noopener noreferrer"
            >
              <LinkLeft>
                <GithubIcon />
                <span>Github</span>
              </LinkLeft>
              <ShareAltIcon width={12} />
            </LinkLine>
            <LinkLine
              href="https://storybook.js.org/docs/get-started/install?ref=ui"
              target="_blank"
              rel="noopener noreferrer"
            >
              <LinkLeft>
                <StorybookIcon />
                <span>Documentation</span>
              </LinkLeft>
              <ShareAltIcon width={12} />
            </LinkLine>
          </LinkContainer>
          <UpgradeBlock />
          <BottomText>
            Open source software maintained by{' '}
            <Link href="https://chromatic.com" target="_blank" rel="noopener noreferrer">
              Chromatic
            </Link>{' '}
            and the{' '}
            <Link
              href="https://github.com/storybookjs/storybook/graphs/contributors"
              rel="noopener noreferrer"
            >
              Storybook Community
            </Link>
          </BottomText>
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
    borderRadius: '10px 10px 0 0',
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

const LinkContainer = styled.div({});

const LinkLine = styled.a(({ theme }) => ({
  all: 'unset',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: theme.typography.size.s2 - 1,
  borderBottom: `1px solid ${theme.appBorderColor}`,
  cursor: 'pointer',
  padding: '0 10px',

  '&:last-child': {
    borderBottom: 'none',
  },
}));

const LinkLeft = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  fontSize: theme.typography.size.s2 - 1,
  height: 40,
  gap: 5,
}));

const BottomText = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2 - 1,
  marginTop: 30,
}));

const CloseButton = styled(Button)({
  alignSelf: 'start',
});
