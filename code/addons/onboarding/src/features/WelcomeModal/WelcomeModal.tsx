import type { FC } from 'react';
import React from 'react';

import { Button } from '../../components/Button/Button';
import { StorybookLogo } from './StorybookLogo';
import {
  ModalContentWrapper,
  SkipButton,
  StyledIcon,
  Title,
  Description,
  Background,
  Circle1,
  Circle2,
  Circle3,
  TopContent,
  ModalWrapper,
} from './WelcomeModal.styled';

interface WelcomeModalProps {
  onProceed: () => void;
  skipOnboarding: () => void;
  container?: HTMLElement;
}

export const WelcomeModal: FC<WelcomeModalProps> = ({ onProceed, skipOnboarding, container }) => {
  return (
    <div style={{ zIndex: 10 }}>
      <ModalWrapper width={540} height={430} defaultOpen container={container}>
        <ModalContentWrapper data-chromatic="ignore">
          <TopContent>
            <StorybookLogo />
            <Title>Welcome to Storybook</Title>
            <Description>
              Storybook helps you develop UI components faster. Learn the basics in a few simple
              steps.
            </Description>
            <Button style={{ marginTop: 4 }} onClick={onProceed}>
              Start your 3 minute tour
            </Button>
          </TopContent>
          <SkipButton onClick={skipOnboarding}>
            Skip tour
            <StyledIcon />
          </SkipButton>
          <Background>
            <Circle1 />
            <Circle2 />
            <Circle3 />
          </Background>
        </ModalContentWrapper>
      </ModalWrapper>
    </div>
  );
};
