import React, { useCallback, useEffect, useState } from 'react';

import { keyframes, styled } from 'storybook/internal/theming';

import { ArrowRightIcon } from '@storybook/icons';

const fadeIn = keyframes({
  from: {
    opacity: 0,
  },
  to: {
    opacity: 1,
  },
});

const slideIn = keyframes({
  from: {
    transform: 'translate(0, 20px)',
    opacity: 0,
  },
  to: {
    transform: 'translate(0, 0)',
    opacity: 1,
  },
});

const scaleIn = keyframes({
  from: {
    opacity: 0,
    transform: 'scale(0.8)',
  },
  to: {
    opacity: 1,
    transform: 'scale(1)',
  },
});

const rotate = keyframes({
  '0%': {
    transform: 'rotate(0deg)',
  },
  '100%': {
    transform: 'rotate(360deg)',
  },
});

const Wrapper = styled.div<{ visible: boolean }>(({ visible }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  opacity: visible ? 1 : 0,
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  transition: 'opacity 1s 0.5s',
}));

const Backdrop = styled.div({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  animation: `${fadeIn} 2s`,
  background: `
    radial-gradient(90% 90%, #ff4785 0%, #db5698 30%, #1ea7fdcc 100%),
    radial-gradient(circle, #ff4785 0%, transparent 80%),
    radial-gradient(circle at 30% 40%, #fc521f99 0%, #fc521f66 20%, transparent 40%),
    radial-gradient(circle at 75% 75%, #fc521f99 0%, #fc521f77 18%, transparent 30%)`,
  '&::before': {
    opacity: 0.5,
    background: `
      radial-gradient(circle at 30% 40%, #fc521f99 0%, #fc521f66 10%, transparent 20%),
      radial-gradient(circle at 75% 75%, #fc521f99 0%, #fc521f77 8%, transparent 20%)`,
    content: '""',
    position: 'absolute',
    top: '-50vw',
    left: '-50vh',
    transform: 'translate(-50%, -50%)',
    width: 'calc(100vw + 100vh)',
    height: 'calc(100vw + 100vh)',
    animation: `${rotate} 12s linear infinite`,
  },
});

const Content = styled.div<{ visible: boolean }>(({ visible }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  color: 'white',
  textAlign: 'center',
  width: '90vw',
  minWidth: 290,
  maxWidth: 410,
  opacity: visible ? 1 : 0,
  transition: 'opacity 0.5s',

  h1: {
    fontSize: 45,
    fontWeight: 'bold',
    animation: `${slideIn} 1.5s 1s backwards`,
  },
}));

const Features = styled.div({
  display: 'flex',
  marginTop: 40,
  div: {
    display: 'flex',
    flexBasis: '33.33%',
    flexDirection: 'column',
    alignItems: 'center',
    animation: `${slideIn} 1s backwards`,
    '&:nth-child(1)': {
      animationDelay: '2s',
    },
    '&:nth-child(2)': {
      animationDelay: '2.5s',
    },
    '&:nth-child(3)': {
      animationDelay: '3s',
    },
  },
  svg: {
    marginBottom: 10,
  },
});

const RadialButton = styled.button({
  display: 'inline-flex',
  position: 'relative',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 40,
  width: 48,
  height: 48,
  padding: 0,
  borderRadius: '50%',
  border: 0,
  outline: 'none',
  background: 'rgba(255, 255, 255, 0.3)',
  cursor: 'pointer',
  transition: 'background 0.2s',
  animation: `${scaleIn} 1.5s 4s backwards`,

  '&:hover, &:focus': {
    background: 'rgba(255, 255, 255, 0.4)',
  },
});

const ArrowIcon = styled(ArrowRightIcon)({
  width: 30,
  color: 'white',
});

const ProgressCircle = styled.svg<{ progress?: boolean; spinner?: boolean }>(({ progress }) => ({
  position: 'absolute',
  top: -1,
  left: -1,
  width: `50px!important`,
  height: `50px!important`,
  transform: 'rotate(-90deg)',
  color: 'white',
  circle: {
    r: '24',
    cx: '25',
    cy: '25',
    fill: 'transparent',
    stroke: progress ? 'currentColor' : 'transparent',
    strokeWidth: '1',
    strokeLinecap: 'round',
    strokeDasharray: Math.PI * 48,
  },
}));

interface SplashScreenProps {
  onDismiss: () => void;
  duration?: number;
}

export const SplashScreen = ({ onDismiss, duration = 6000 }: SplashScreenProps) => {
  const [progress, setProgress] = useState((-4000 * 100) / duration); // 4 seconds delay
  const [visible, setVisible] = useState(true);
  const ready = progress >= 100;

  const dismiss = useCallback(() => {
    setVisible(false);
    const timeout = setTimeout(onDismiss, 1500);
    return () => clearTimeout(timeout);
  }, [onDismiss]);

  useEffect(() => {
    if (!duration) {
      return;
    }
    const framelength = 1000 / 50; // 50 frames per second
    const increment = 100 / (duration / framelength); // 0-100% at 20ms intervals
    const interval = setInterval(() => setProgress((prev) => prev + increment), framelength);
    return () => clearInterval(interval);
  }, [duration]);

  useEffect(() => {
    if (ready) {
      dismiss();
    }
  }, [ready, dismiss]);

  return (
    <Wrapper visible={visible}>
      <Backdrop />
      <Content visible={visible}>
        <h1>Meet your new frontend workshop</h1>
        <Features>
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" width="33" height="32">
              <path
                d="M4.06 0H32.5v28.44h-3.56V32H.5V3.56h3.56V0Zm21.33 7.11H4.06v21.33h21.33V7.11Z"
                fill="currentColor"
              />
            </svg>
            Development
          </div>
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
              <path
                d="M15.95 32c-1.85 0-3.1-1.55-3.1-3.54 0-1.1.45-2.78 1.35-5.03.9-2.3 1.35-4.51 1.35-6.81a22.21 22.21 0 0 0-5.1 3.67c-2.5 2.47-4.95 4.9-7.55 4.9-1.6 0-2.9-1.1-2.9-2.43 0-1.46 1.35-2.91 4.3-3.62 1.45-.36 3.1-.75 4.95-1.06 1.8-.31 3.8-1.02 5.9-2.08a23.77 23.77 0 0 0-6.1-2.12C5.3 13.18 2.3 12.6 1 11.28.35 10.6 0 9.9 0 9.14 0 7.82 1.2 6.8 2.95 6.8c2.65 0 5.75 3.1 7.95 5.3 1.1 1.1 2.65 2.21 4.65 3.27v-.57c0-1.77-.15-3.23-.55-4.3-.8-2.11-2.05-5.43-2.05-6.97 0-2.04 1.3-3.54 3.1-3.54 1.75 0 3.1 1.41 3.1 3.54 0 1.06-.45 2.78-1.35 5.12-.9 2.35-1.35 4.6-1.35 6.72 2.85-1.59 2.5-1.41 4.95-3.5 2.35-2.29 4-3.7 4.9-4.23.95-.58 1.9-.84 2.9-.84 1.6 0 2.8.97 2.8 2.34 0 1.5-1.25 2.78-4.15 3.62-1.4.4-3.05.75-4.9 1.1-1.9.36-3.9 1.07-6.1 2.13a23.3 23.3 0 0 0 5.95 2.08c3.65.7 6.75 1.32 8.15 2.6.7.67 1.05 1.33 1.05 2.08 0 1.33-1.2 2.43-2.95 2.43-2.95 0-6.75-4.15-8.2-5.61-.7-.7-2.2-1.72-4.4-2.96v.57c0 1.9.45 4.03 1.3 6.32.85 2.3 1.3 3.94 1.3 4.95 0 2.08-1.35 3.54-3.1 3.54Z"
                fill="currentColor"
              />
            </svg>
            Testing
          </div>
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" width="33" height="32">
              <path
                d="M.5 16a16 16 0 1 1 32 0 16 16 0 0 1-32 0Zm16 12.44A12.44 12.44 0 0 1 4.3 13.53a8 8 0 1 0 9.73-9.73 12.44 12.44 0 1 1 2.47 24.64ZM12.06 16a4.44 4.44 0 1 1 0-8.89 4.44 4.44 0 0 1 0 8.89Z"
                fill="currentColor"
                fillRule="evenodd"
              />
            </svg>
            Documentation
          </div>
        </Features>
        <RadialButton onClick={dismiss}>
          <ArrowIcon />
          <ProgressCircle xmlns="http://www.w3.org/2000/svg">
            <circle />
          </ProgressCircle>
          <ProgressCircle xmlns="http://www.w3.org/2000/svg" progress>
            <circle
              strokeDashoffset={Math.PI * 48 * (1 - Math.max(0, Math.min(progress, 100)) / 100)}
            />
          </ProgressCircle>
        </RadialButton>
      </Content>
    </Wrapper>
  );
};
