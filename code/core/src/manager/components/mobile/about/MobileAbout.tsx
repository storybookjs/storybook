import type { FC } from 'react';
import React, { useEffect, useRef } from 'react';

import { ActionList, Button, Link, ScrollArea } from 'storybook/internal/components';

import { ArrowLeftIcon, GithubIcon, ShareAltIcon, StorybookIcon } from '@storybook/icons';

import { FocusScope } from 'react-aria/FocusScope';
import { useTransitionState } from 'react-transition-state';
import { keyframes, styled } from 'storybook/theming';

import { MOBILE_TRANSITION_DURATION } from '../../../constants.ts';
import { useLayout } from '../../layout/LayoutProvider.tsx';
import { UpgradeBlock } from '../../upgrade/UpgradeBlock.tsx';

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
      {/* The overlay covers the menu drawer's content but stays inside its focus scope, so without
       a scope of its own, Tab would keep cycling through the obscured menu underneath. */}
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <FocusScope contain restoreFocus autoFocus>
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
            <LinkList>
              <ActionList.Item>
                <ActionList.Link
                  ariaLabel={false}
                  href="https://github.com/storybookjs/storybook"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ActionList.Icon>
                    <GithubIcon />
                  </ActionList.Icon>
                  <ActionList.Text>
                    <span>Github</span>
                  </ActionList.Text>
                  <ActionList.Icon>
                    <ShareAltIcon />
                  </ActionList.Icon>
                </ActionList.Link>
              </ActionList.Item>
              <ActionList.Item>
                <ActionList.Link
                  ariaLabel={false}
                  href="https://storybook.js.org/docs/get-started/install?ref=ui"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ActionList.Icon>
                    <StorybookIcon />
                  </ActionList.Icon>
                  <ActionList.Text>
                    <span>Documentation</span>
                  </ActionList.Text>
                  <ActionList.Icon>
                    <ShareAltIcon />
                  </ActionList.Icon>
                </ActionList.Link>
              </ActionList.Item>
            </LinkList>
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
      </FocusScope>
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

const LinkList = styled(ActionList)({
  padding: 0,
});

const BottomText = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2 - 1,
  marginTop: 30,
}));

const CloseButton = styled(Button)({
  alignSelf: 'start',
});
