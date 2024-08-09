import type { FC } from 'react';
import React, { useRef } from 'react';

import { Link } from '@storybook/core/components';
import { styled } from '@storybook/core/theming';
import { ArrowLeftIcon, GithubIcon, ShareAltIcon, StorybookIcon } from '@storybook/icons';

import { Transition, type TransitionStatus } from 'react-transition-group';

import { MOBILE_TRANSITION_DURATION } from '../../../constants';
import { useLayout } from '../../layout/LayoutProvider';
import { UpgradeBlock } from '../../upgrade/UpgradeBlock';

export const MobileAbout: FC = () => {
  const { isMobileAboutOpen, setMobileAboutOpen } = useLayout();
  const aboutRef = useRef(null);

  return (
    <Transition
      nodeRef={aboutRef}
      in={isMobileAboutOpen}
      timeout={MOBILE_TRANSITION_DURATION}
      appear
      mountOnEnter
      unmountOnExit
    >
      {(state) => (
        <Container ref={aboutRef} state={state} transitionDuration={MOBILE_TRANSITION_DURATION}>
          <Button onClick={() => setMobileAboutOpen(false)} title="Close about section">
            <ArrowLeftIcon />
            Back
          </Button>
          <LinkContainer>
            <LinkLine href="https://github.com/storybookjs/storybook" target="_blank">
              <LinkLeft>
                <GithubIcon />
                <span>Github</span>
              </LinkLeft>
              <ShareAltIcon width={12} />
            </LinkLine>
            <LinkLine
              href="https://storybook.js.org/docs/react/get-started/install/"
              target="_blank"
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
            <Link href="https://chromatic.com" target="_blank">
              Chromatic
            </Link>{' '}
            and the{' '}
            <Link href="https://github.com/storybookjs/storybook/graphs/contributors">
              Storybook Community
            </Link>
          </BottomText>
        </Container>
      )}
    </Transition>
  );
};

const Container = styled.div<{ state: TransitionStatus; transitionDuration: number }>(
  ({ theme, state, transitionDuration }) => ({
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    zIndex: 11,
    transition: `all ${transitionDuration}ms ease-in-out`,
    overflow: 'scroll',
    padding: '25px 10px 10px',
    color: theme.color.defaultText,
    background: theme.background.content,
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
    transform: `${(() => {
      switch (state) {
        case 'entering':
        case 'entered':
          return 'translateX(0)';
        case 'exiting':
        case 'exited':
          return 'translateX(20px)';
        default:
          return 'translateX(0)';
      }
    })()}`,
  })
);

const LinkContainer = styled.div({
  marginTop: 20,
  marginBottom: 20,
});

const LinkLine = styled.a(({ theme }) => ({
  all: 'unset',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: theme.typography.size.s2 - 1,
  height: 52,
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

const Button = styled.button(({ theme }) => ({
  all: 'unset',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: 'currentColor',
  fontSize: theme.typography.size.s2 - 1,
  padding: '0 10px',
}));
